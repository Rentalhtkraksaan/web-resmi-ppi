import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import {
  getServerSession,
  hashPassword,
  inspectPayloadForAttacks,
  sanitizeString,
  validateCommitteeRegistrationInput,
} from "@/lib/security";

export async function GET() {
  await ensureSeeded();
  const session = getServerSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin yang berhak mengakses manajemen akun." }, { status: 403 });
  }

  const [users, logs] = await Promise.all([
    prisma.userAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        fullName: true,
        angkatan: true,
        role: true,
        permissions: true,
        assignedSchoolId: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.securityAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      permissions: (() => {
        try {
          return JSON.parse(u.permissions || "{}");
        } catch {
          return {};
        }
      })(),
    })),
    logs,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const session = getServerSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized: Super Admin required" }, { status: 403 });
  }

  const body = await req.json();
  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  const username = sanitizeString(String(body.username || "")).toLowerCase().replace(/\s+/g, "_");
  const password = String(body.password || "");
  const fullName = sanitizeString(String(body.fullName || ""));
  const angkatan = sanitizeString(String(body.angkatan || "-"));
  const rawEmail = String(body.email || "").trim().toLowerCase();
  const rawPhone = String(body.phone || "").trim();
  const role = ["SUPER_ADMIN", "ADMIN", "USER", "PENJAB_ROADSHOW"].includes(body.role) ? body.role : "USER";
  const permissions = body.permissions || {};
  const assignedSchoolId = body.assignedSchoolId || null;

  if (!username || !password || !fullName) {
    return NextResponse.json({ error: "Username, password, dan nama lengkap wajib diisi." }, { status: 400 });
  }
  if (username.length > 20) {
    return NextResponse.json({ error: "Username maksimal 20 karakter." }, { status: 400 });
  }

  let normalizedPhone = "";
  let normalizedEmail = "";
  if (rawPhone || rawEmail) {
    const check = validateCommitteeRegistrationInput({
      fullName,
      phone: rawPhone || "081298765432",
      email: rawEmail || "panitia.ppi@gmail.com",
      angkatan: angkatan || "2026",
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    if (rawPhone) normalizedPhone = check.normalizedPhone;
    if (rawEmail) normalizedEmail = check.normalizedEmail;
  }

  // Fast indexed duplicate checks (BUG-HUNTER-08)
  const [existingUser, existingEmail, existingPhone] = await Promise.all([
    prisma.userAccount.findFirst({
      where: { username: username.toLowerCase() },
      select: { id: true },
    }),
    normalizedEmail
      ? prisma.userAccount.findFirst({
        where: { email: normalizedEmail },
        select: { id: true },
      })
      : null,
    normalizedPhone
      ? prisma.userAccount.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { phone: normalizedPhone.replace(/^0/, "62") },
          ],
        },
        select: { id: true },
      })
      : null,
  ]);

  if (existingUser) {
    return NextResponse.json({ error: "Username sudah terdaftar." }, { status: 409 });
  }
  if (existingEmail) {
    return NextResponse.json({ error: "Email tersebut sudah terdaftar oleh panitia lain." }, { status: 409 });
  }
  if (existingPhone) {
    return NextResponse.json({ error: "Nomor telepon tersebut sudah terdaftar oleh panitia lain." }, { status: 409 });
  }

  const created = await prisma.userAccount.create({
    data: {
      username,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash: hashPassword(password),
      fullName,
      angkatan,
      role,
      permissions: JSON.stringify(permissions),
      assignedSchoolId,
      isActive: true,
    },
  });

  await prisma.securityAuditLog.create({
    data: {
      actorName: session.fullName,
      actorRole: session.role,
      action: "CREATE_USER_ACCOUNT",
      details: `Membuat akun ${username} dengan role ${role}`,
    },
  });

  return NextResponse.json({ success: true, id: created.id });
}

export async function PUT(req: NextRequest) {
  await ensureSeeded();
  const session = getServerSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized: Super Admin required" }, { status: 403 });
  }

  const body = await req.json();
  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "ID akun diperlukan" }, { status: 400 });

  // Prevent Super Admin self-lockout or privilege loss (BUG-HUNTER-04)
  if (id === session.userId) {
    if (body.role !== undefined && body.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Anda tidak dapat menurunkan level role akun Super Admin Anda sendiri!" },
        { status: 400 }
      );
    }
    if (body.isActive !== undefined && Boolean(body.isActive) === false) {
      return NextResponse.json(
        { error: "Anda tidak dapat menonaktifkan akun Super Admin Anda sendiri yang sedang aktif!" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, any> = {};
  if (body.fullName !== undefined) updateData.fullName = sanitizeString(String(body.fullName));
  if (body.angkatan !== undefined) updateData.angkatan = sanitizeString(String(body.angkatan));
  if (body.role !== undefined && ["SUPER_ADMIN", "ADMIN", "USER", "PENJAB_ROADSHOW"].includes(body.role)) {
    updateData.role = body.role;
  }
  if (body.permissions !== undefined) {
    updateData.permissions = JSON.stringify(body.permissions);
  }
  if (body.assignedSchoolId !== undefined) {
    updateData.assignedSchoolId = body.assignedSchoolId || null;
  }
  if (body.isActive !== undefined) {
    updateData.isActive = Boolean(body.isActive);
  }
  if (body.newPassword && String(body.newPassword).trim().length >= 4) {
    updateData.passwordHash = hashPassword(String(body.newPassword).trim());
  }

  const updatedUser = await prisma.userAccount.update({
    where: { id },
    data: updateData,
  });

  await prisma.securityAuditLog.create({
    data: {
      actorName: session.fullName,
      actorRole: session.role,
      action: body.newPassword ? "RESET_PASSWORD_BY_SUPERADMIN" : "UPDATE_USER_PERMISSIONS",
      details: body.newPassword
        ? `Super Admin mereset password untuk akun: ${updatedUser.username}`
        : `Mengubah hak akses/penugasan akun: ${updatedUser.username}`,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const session = getServerSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized: Super Admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID akun diperlukan" }, { status: 400 });
  if (id === session.userId) {
    return NextResponse.json({ error: "Tidak dapat menghapus akun Super Admin yang sedang aktif." }, { status: 400 });
  }

  await prisma.userAccount.delete({ where: { id } });

  await prisma.securityAuditLog.create({
    data: {
      actorName: session.fullName,
      actorRole: session.role,
      action: "DELETE_USER_ACCOUNT",
      details: `Menghapus akun ID ${id}`,
    },
  });

  return NextResponse.json({ success: true });
}
