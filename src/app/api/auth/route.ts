import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import {
  generateSignedCaptcha,
  getServerSession,
  hashPassword,
  inspectPayloadForAttacks,
  normalizePhone,
  sanitizeString,
  SESSION_COOKIE_NAME,
  signSessionToken,
  validateCommitteeRegistrationInput,
  verifyPassword,
  verifySignedCaptcha,
} from "@/lib/security";
import { firebasePush, ROADSHOW_RTDB_URL, UMUM_RTDB_URL } from "@/lib/firebase";

export async function GET(req: NextRequest) {
  // Fast path: Endpoint to obtain cryptographically signed Captcha for client form
  // Evaluated BEFORE database seeding or locks so it returns instantaneously (<1ms)
  const { searchParams } = new URL(req.url);
  if (searchParams.get("action") === "captcha") {
    const captcha = generateSignedCaptcha();
    return NextResponse.json(
      {
        success: true,
        code: captcha.code,
        token: captcha.token,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }

  try {
    await ensureSeeded();
  } catch (seedErr) {
    console.warn("Seeding non-fatal warning:", seedErr);
  }

  const session = getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  // Fast path for Super Admin: always allow instant access without requiring DB round-trip
  if (session.role === "SUPER_ADMIN") {
    return NextResponse.json({
      authenticated: true,
      user: {
        userId: session.userId || "master_superadmin_01",
        username: session.username || "aditya",
        email: session.email || "aditya@ppikabupatenprobolinggo.id",
        phone: session.phone || "085176871609",
        fullName: session.fullName || "Achmad Furqon Aditya Putra (Super Admin)",
        angkatan: session.angkatan || "2023",
        role: "SUPER_ADMIN",
        permissions: session.permissions || {
          manageLanding: true,
          manageMerchandise: true,
          manageReviews: true,
          manageRoadshow: true,
          manageVoting: true,
        },
        assignedSchoolId: null,
      },
    });
  }

  // Refresh permissions from DB in case Super Admin updated them live
  const dbUser = await prisma.userAccount.findUnique({
    where: { id: session.userId },
  });

  if (!dbUser || !dbUser.isActive) {
    const res = NextResponse.json({ authenticated: false, user: null });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  let parsedPerms = {};
  try {
    parsedPerms = JSON.parse(dbUser.permissions || "{}");
  } catch {
    parsedPerms = {};
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      phone: dbUser.phone,
      fullName: dbUser.fullName,
      angkatan: dbUser.angkatan,
      role: dbUser.role,
      permissions: parsedPerms,
      assignedSchoolId: dbUser.assignedSchoolId,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
  } catch (seedErr) {
    console.warn("Seeding non-fatal warning:", seedErr);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local-client";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  // 1. Cracker / Pentester WAF Inspection (SQLi, XSS, PHP, Prototype Pollution)
  const wafCheck = inspectPayloadForAttacks(body);
  if (!wafCheck.safe) {
    await prisma.securityAuditLog.create({
      data: {
        actorName: String(body?.username || body?.email || "Unknown"),
        actorRole: "UNAUTHENTICATED",
        action: "WAF_BLOCKED_ATTACK",
        details: wafCheck.reason || "Malicious payload blocked",
        ipAddress: ip,
      },
    }).catch(() => {});
    return NextResponse.json(
      {
        error: "SECURITY ALERT: Permintaan ditolak oleh sistem proteksi anti-injeksi (WAF). Percobaan ini telah dicatat.",
      },
      { status: 403 }
    );
  }

  const action = body?.action;

  // =========================================================================
  // ACTION: GET SIGNED CAPTCHA TOKEN (BUG-HUNTER-01)
  // =========================================================================
  if (action === "captcha" || action === "get_captcha") {
    const captcha = generateSignedCaptcha();
    return NextResponse.json(
      {
        success: true,
        code: captcha.code,
        token: captcha.token,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }

  // =========================================================================
  // ACTION: LIVE CHECK DUPLICATE EMAIL / PHONE / USERNAME ("ANTISIPASI BOHONG")
  // =========================================================================
  if (action === "check_duplicate") {
    try {
      const rawEmail = String(body.email || "").trim().toLowerCase();
      const rawPhone = normalizePhone(String(body.phone || ""));
      const rawUsername = String(body.username || "").trim().toLowerCase().replace(/\s+/g, "_");

      const [emailOwner, phoneOwner, usernameOwner] = await Promise.all([
        rawEmail
          ? prisma.userAccount.findFirst({
              where: { email: rawEmail },
              select: { id: true },
            }).catch(() => null)
          : null,
        rawPhone
          ? prisma.userAccount.findFirst({
              where: {
                OR: [{ phone: rawPhone }, { phone: rawPhone.replace(/^0/, "62") }],
              },
              select: { id: true },
            }).catch(() => null)
          : null,
        rawUsername
          ? prisma.userAccount.findFirst({
              where: { username: rawUsername },
              select: { id: true },
            }).catch(() => null)
          : null,
      ]);

      let phoneError: string | null = null;
      if (rawPhone) {
        if (!rawPhone.startsWith("08")) {
          phoneError = "Nomor WhatsApp wajib diawali '08'.";
        } else if (rawPhone.length < 9 || rawPhone.length > 13) {
          phoneError = "Nomor WhatsApp harus 9 - 13 digit angka.";
        } else {
          const tail = rawPhone.slice(2);
          if (
            /^(\d)\1{4,}$/.test(tail) ||
            "0123456789012345".includes(tail) ||
            "9876543210987654".includes(tail)
          ) {
            phoneError = "Terdeteksi pola nomor beruntun/berulang! Masukkan nomor WhatsApp asli.";
          }
        }
      }

      let emailError: string | null = null;
      if (rawEmail) {
        if (rawEmail.length > 50) {
          emailError = "Alamat email maksimal 50 karakter.";
        } else {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(rawEmail)) {
            emailError = "Format email belum valid (contoh: nama@gmail.com).";
          }
        }
      }

      return NextResponse.json({
        emailTaken: Boolean(emailOwner),
        phoneTaken: Boolean(phoneOwner),
        usernameTaken: Boolean(usernameOwner),
        phoneError,
        emailError,
      });
    } catch {
      return NextResponse.json({
        emailTaken: false,
        phoneTaken: false,
        usernameTaken: false,
        phoneError: null,
        emailError: null,
      });
    }
  }

  // =========================================================================
  // ACTION: REGISTER (2-Step Registration with Real-Time Rules)
  // =========================================================================
  if (action === "register") {
    const fullName = sanitizeString(String(body.fullName || "")).trim().slice(0, 50);
    const angkatan = String(body.angkatan || "").trim();
    const email = String(body.email || "").trim().toLowerCase().slice(0, 50);
    const rawPhone = String(body.phone || "").trim().replace(/[^0-9]/g, "");
    const phone = rawPhone.startsWith("628") ? `08${rawPhone.slice(3)}` : rawPhone;
    const password = String(body.password || "");
    const currentYear = new Date().getFullYear();

    // 1. Validasi Nama Lengkap
    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi minimal 2 huruf." }, { status: 400 });
    }
    if (fullName.length > 50) {
      return NextResponse.json({ error: "Nama lengkap maksimal 50 huruf." }, { status: 400 });
    }

    // 2. Validasi Angkatan PPI
    if (!/^\d{4}$/.test(angkatan)) {
      return NextResponse.json({ error: "Angkatan PPI wajib berupa 4 digit angka tahun (contoh: 2024)." }, { status: 400 });
    }
    const angkatanNum = Number(angkatan);
    if (angkatanNum > currentYear) {
      return NextResponse.json(
        { error: `Angkatan PPI tidak boleh melebihi tahun sekarang (${currentYear}).` },
        { status: 400 }
      );
    }
    if (angkatanNum < 1970) {
      return NextResponse.json({ error: "Tahun angkatan PPI tidak valid." }, { status: 400 });
    }

    // 3. Validasi Email
    if (!email) {
      return NextResponse.json({ error: "Alamat email wajib diisi." }, { status: 400 });
    }
    if (email.length > 50) {
      return NextResponse.json({ error: "Alamat email maksimal 50 karakter." }, { status: 400 });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid (contoh: nama@gmail.com)." }, { status: 400 });
    }

    // 4. Validasi WhatsApp
    if (!phone) {
      return NextResponse.json({ error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }
    if (!phone.startsWith("08")) {
      return NextResponse.json({ error: "Nomor WhatsApp wajib diawali '08'." }, { status: 400 });
    }
    if (phone.length < 9 || phone.length > 13) {
      return NextResponse.json({ error: "Nomor WhatsApp harus terdiri dari 9 hingga 13 digit angka." }, { status: 400 });
    }
    const phoneTail = phone.slice(2);
    if (
      /^(\d)\1{4,}$/.test(phoneTail) ||
      "0123456789012345".includes(phoneTail) ||
      "9876543210987654".includes(phoneTail)
    ) {
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak boleh berpola angka beruntun/berulang!" },
        { status: 400 }
      );
    }

    // 5. Validasi Password
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: "Password wajib memiliki minimal 1 huruf besar (A-Z)." }, { status: 400 });
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ error: "Password wajib memiliki minimal 1 huruf kecil (a-z)." }, { status: 400 });
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Password wajib memiliki minimal 1 angka (0-9)." }, { status: 400 });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password)) {
      return NextResponse.json({ error: "Password wajib memiliki minimal 1 karakter ikon unik / simbol (!@#$% dll.)." }, { status: 400 });
    }

    // 6. Cek Duplikat di Database
    const [existingEmail, existingPhone] = await Promise.all([
      prisma.userAccount.findFirst({ where: { email } }),
      prisma.userAccount.findFirst({
        where: {
          OR: [{ phone }, { phone: phone.replace(/^0/, "62") }],
        },
      }),
    ]);
    if (existingEmail) {
      return NextResponse.json(
        { error: "Alamat email ini sudah terdaftar! Silakan login atau gunakan email lain." },
        { status: 409 }
      );
    }
    if (existingPhone) {
      return NextResponse.json(
        { error: "Nomor WhatsApp ini sudah terdaftar! Silakan login atau gunakan nomor lain." },
        { status: 409 }
      );
    }

    // 7. Auto-Generate Unique Username
    let baseUsername = fullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 16);
    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = email.split("@")[0].replace(/[^a-z0-9]/g, "_").slice(0, 16);
    }
    let uniqueUsername = baseUsername;
    let counter = 1;
    while (await prisma.userAccount.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${baseUsername.slice(0, 14)}_${counter}`;
      counter++;
    }

    // 8. Simpan Akun Baru (Role: USER / Panitia PPI)
    const passwordHash = hashPassword(password);
    const defaultPermissions = {
      inputBB: true,
      inputTB: true,
      inputRegistrasi: true,
    };

    const newUser = await prisma.userAccount.create({
      data: {
        username: uniqueUsername,
        passwordHash,
        fullName,
        angkatan,
        email,
        phone,
        role: "USER",
        permissions: JSON.stringify(defaultPermissions),
        isActive: true,
      },
    });

    // 9. Login Otomatis via Session Cookie
    const token = signSessionToken({
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      phone: newUser.phone,
      fullName: newUser.fullName,
      angkatan: newUser.angkatan,
      role: newUser.role as any,
      permissions: defaultPermissions,
      assignedSchoolId: null,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        fullName: newUser.fullName,
        angkatan: newUser.angkatan,
        role: newUser.role,
        permissions: defaultPermissions,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: fullName,
        actorRole: "USER",
        action: "REGISTER_NEW_ACCOUNT",
        details: `Pendaftaran akun anggota PPI Akt. ${angkatan} berhasil`,
        ipAddress: ip,
      },
    }).catch(() => {});

    return response;
  }

  // =========================================================================
  // ACTION: LOGIN (Supports Username, Email, or Phone + Password)
  // =========================================================================
  if (action === "login") {
    const identifier = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/Email dan password wajib diisi." }, { status: 400 });
    }
    if (!identifier.includes("@") && identifier.length > 20) {
      return NextResponse.json({ error: "Username maksimal 20 karakter." }, { status: 400 });
    }

    const cleanId = identifier.toLowerCase().replace(/\s+/g, "_");

    // =========================================================================
    // INVIOLABLE MASTER SUPER ADMIN FAST-PATH (Bypasses cold-start & SQLite locks)
    // =========================================================================
    const isMasterSuperAdmin =
      (cleanId === "aditya" || cleanId === "superadmin") &&
      password === "AdityaSuper27!";

    if (isMasterSuperAdmin) {
      const superUser = {
        userId: "master_superadmin_01",
        username: cleanId === "aditya" ? "aditya" : "superadmin",
        email: "aditya@ppikabupatenprobolinggo.id",
        phone: "085176871609",
        fullName: "Achmad Furqon Aditya Putra (Super Admin)",
        angkatan: "2023",
        role: "SUPER_ADMIN" as const,
        permissions: {
          inputBB: true,
          inputTB: true,
          inputRegistrasi: true,
          manageLanding: true,
          manageMerchandise: true,
          manageReviews: true,
          manageRoadshow: true,
          manageVoting: true,
        },
        assignedSchoolId: null,
      };

      const token = signSessionToken(superUser);

      const response = NextResponse.json({
        success: true,
        user: superUser,
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 12 * 60 * 60,
      });

      return response;
    }

    // 1. Enforce Server-Side Captcha Verification (BUG-HUNTER-01 for standard users)
    const captchaCheck = verifySignedCaptcha(body.captchaInput, body.captchaToken);
    if (!captchaCheck.valid) {
      return NextResponse.json(
        { error: captchaCheck.reason || "Kode verifikasi (Captcha) salah atau kedaluwarsa!" },
        { status: 400 }
      );
    }

    try {
      const ipKey = `ip_${ip.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const userKey = `user_${cleanId}`;

      const [ipRecord, userRecord] = await Promise.all([
        prisma.loginAttempt.findUnique({ where: { ipOrFingerprint: ipKey } }).catch(() => null),
        prisma.loginAttempt.findUnique({ where: { ipOrFingerprint: userKey } }).catch(() => null),
      ]);

      const activeLock =
        ipRecord?.lockedUntil && ipRecord.lockedUntil > new Date()
          ? ipRecord
          : userRecord?.lockedUntil && userRecord.lockedUntil > new Date()
          ? userRecord
          : null;

      if (activeLock?.lockedUntil) {
        const remainingSec = Math.ceil((activeLock.lockedUntil.getTime() - Date.now()) / 1000);
        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan gagal (Anti Brute-Force). Akun/IP dikunci sementara selama ${remainingSec} detik demi keamanan.`,
          },
          { status: 429 }
        );
      }

      // Direct indexed query for user
      const normalizedIdPhone = normalizePhone(identifier);
      const user = await prisma.userAccount.findFirst({
        where: {
          OR: [
            { username: cleanId },
            { username: identifier },
            { email: identifier.toLowerCase() },
            ...(normalizedIdPhone.length >= 10
              ? [
                  { phone: normalizedIdPhone },
                  { phone: normalizedIdPhone.replace(/^0/, "62") },
                ]
              : []),
          ],
        },
      });

      if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
        const newAttempts = Math.max(ipRecord?.attempts || 0, userRecord?.attempts || 0) + 1;
        const shouldLock = newAttempts >= 5;
        const lockedUntil = shouldLock ? new Date(Date.now() + 5 * 60 * 1000) : null;

        await Promise.all([
          prisma.loginAttempt.upsert({
            where: { ipOrFingerprint: ipKey },
            update: {
              attempts: shouldLock ? 0 : newAttempts,
              lockedUntil,
              lastAttemptAt: new Date(),
            },
            create: {
              ipOrFingerprint: ipKey,
              attempts: newAttempts,
              lockedUntil,
            },
          }).catch(() => null),
          prisma.loginAttempt.upsert({
            where: { ipOrFingerprint: userKey },
            update: {
              attempts: shouldLock ? 0 : newAttempts,
              lockedUntil,
              lastAttemptAt: new Date(),
            },
            create: {
              ipOrFingerprint: userKey,
              attempts: newAttempts,
              lockedUntil,
            },
          }).catch(() => null),
        ]);

        return NextResponse.json(
          {
            error: shouldLock
              ? "Akses dikunci selama 5 menit karena 5x kesalahan kredensial."
              : `Username/Email atau Password salah! (Sisa kesempatan: ${5 - newAttempts}x)`,
          },
          { status: 401 }
        );
      }

      // Reset attempts on successful login
      await prisma.loginAttempt
        .deleteMany({
          where: {
            ipOrFingerprint: { in: [ipKey, userKey] },
          },
        })
        .catch(() => {});

      let permissions = {};
      try {
        permissions = JSON.parse(user.permissions || "{}");
      } catch {
        permissions = {};
      }

      const token = signSessionToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        angkatan: user.angkatan,
        role: user.role as any,
        permissions,
        assignedSchoolId: user.assignedSchoolId,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          userId: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          fullName: user.fullName,
          angkatan: user.angkatan,
          role: user.role,
          permissions,
          assignedSchoolId: user.assignedSchoolId,
        },
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 12 * 60 * 60,
      });

      return response;
    } catch (dbErr) {
      console.error("Login processing error:", dbErr);
      return NextResponse.json(
        { error: "Terjadi gangguan sistem database. Silakan coba kembali." },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // ACTION: LOGOUT (Clean Logout - Tanpa Otomatis Nambah Ulasan)
  // =========================================================================
  if (action === "logout") {
    const session = getServerSession();
    if (session) {
      if (session.role === "USER") {
        // Clear scanned school session on logout so next login requires scanning Super Admin QR again
        await prisma.userAccount
          .update({
            where: { id: session.userId },
            data: { assignedSchoolId: null },
          })
          .catch(() => {});
      }

      await prisma.securityAuditLog.create({
        data: {
          actorName: session.fullName,
          actorRole: session.role,
          action: "LOGOUT",
          details: "Logout dari sistem",
          ipAddress: ip,
        },
      });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Pragma, Cache-Control",
    },
  });
}
