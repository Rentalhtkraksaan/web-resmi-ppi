import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import {
  getServerSession,
  inspectPayloadForAttacks,
  RolePermissions,
  sanitizeString,
} from "@/lib/security";
import { firebaseGet, firebasePush, firebasePut, ROADSHOW_RTDB_URL, UMUM_RTDB_URL } from "@/lib/firebase";

// Helper: Safely delete physical file from /uploads/ directory (BUG-HUNTER-05)
async function deleteUploadedFile(fileUrl?: string | null) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return;
  try {
    const filename = path.basename(fileUrl);
    // Path traversal check
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return;
    const fullPath = path.join(process.cwd(), "public", "uploads", filename);
    await unlink(fullPath);
  } catch {
    // Silently ignore if file doesn't exist or is external
  }
}

async function getAuthorizedPermissions() {
  const session = getServerSession();
  if (!session) return { session: null, perms: {} as RolePermissions };
  const dbUser = await prisma.userAccount.findUnique({ where: { id: session.userId } });
  if (!dbUser || !dbUser.isActive) return { session: null, perms: {} as RolePermissions };

  if (dbUser.role === "SUPER_ADMIN") {
    return {
      session: { ...session, role: "SUPER_ADMIN" as const },
      perms: {
        manageLanding: true,
        manageMerchandise: true,
        manageReviews: true,
        manageRoadshow: true,
        manageVoting: true,
      },
    };
  }

  let perms: RolePermissions = {};
  try {
    perms = JSON.parse(dbUser.permissions || "{}");
  } catch {
    perms = {};
  }
  return { session: { ...session, role: dbUser.role as "ADMIN" | "USER" }, perms };
}

export async function GET() {
  await ensureSeeded();
  const { session, perms } = await getAuthorizedPermissions();
  const canSeeHiddenReviews = session?.role === "SUPER_ADMIN" || perms.manageReviews;

  // Ensure default HERO_BUTTON items exist so "Visit Profile BPIP" and "Cek Kandidat Lolos Roadshow" can be full CRUD
  const heroBtnCount = await prisma.landingItem.count({ where: { section: "HERO_BUTTON" } });
  if (heroBtnCount === 0) {
    await prisma.landingItem.createMany({
      data: [
        {
          section: "HERO_BUTTON",
          title: "Visit Profile BPIP",
          fileUrl: "https://paskibraka.bpip.go.id/dashboard",
          subtitle: "primary",
          sortOrder: 1,
        },
        {
          section: "HERO_BUTTON",
          title: "Cek Kandidat Lolos Roadshow",
          fileUrl: "/roadshow",
          subtitle: "secondary",
          sortOrder: 2,
        },
      ],
    });
  }

  const [config, items, reviews] = await Promise.all([
    prisma.landingConfig.findFirst(),
    prisma.landingItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.review.findMany({
      where: canSeeHiddenReviews ? {} : { isVisible: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Sync with persistent Cloud RTDB to ensure reviews are never lost across Vercel Lambda container recycles
  let mergedReviews = [...reviews];
  try {
    const [roadshowData, umumData] = await Promise.all([
      firebaseGet<Record<string, any>>(ROADSHOW_RTDB_URL, "penilaian"),
      firebaseGet<Record<string, any>>(UMUM_RTDB_URL, "penilaian"),
    ]);

    const combinedRtdb = { ...(roadshowData || {}), ...(umumData || {}) };

    if (Object.keys(combinedRtdb).length > 0) {
      const existingSigs = new Set(
        mergedReviews.map((r) => `${r.nama.trim().toLowerCase()}_${r.pesan.trim().toLowerCase()}`)
      );

      for (const [key, val] of Object.entries(combinedRtdb)) {
        if (val && typeof val === "object" && (val as any).nama && (val as any).pesan) {
          const v = val as any;
          const sig = `${String(v.nama).trim().toLowerCase()}_${String(v.pesan).trim().toLowerCase()}`;

          if (!existingSigs.has(sig)) {
            existingSigs.add(sig);
            mergedReviews.unshift({
              id: `rtdb_${key}`,
              nama: String(v.nama),
              kategori: v.kategori === "ppi" ? "ppi" : "umum",
              angkatan: String(v.angkatan || "-"),
              rating: Number(v.rating) || 5,
              pesan: String(v.pesan),
              source: "LANDING",
              isVisible: true,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            } as any);
          }

          // Mirror to paskab-c3eb4 if it was missing there
          if (!umumData || !umumData[key]) {
            firebasePut(UMUM_RTDB_URL, `penilaian/${key}`, v).catch(() => {});
          }
        }
      }
    }
  } catch {
    // non-fatal fallback
  }

  return NextResponse.json({
    config,
    items,
    reviews: mergedReviews,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json();

  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  // 1. Public or Authenticated Review Submission (Max 50 chars & block .php)
  if (body.type === "review") {
    const nama = sanitizeString(String(body.nama || ""));
    const kategori = ["umum", "ppi"].includes(body.kategori) ? body.kategori : "umum";
    const angkatan = sanitizeString(String(body.angkatan || "-")).slice(0, 10);
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const pesan = sanitizeString(String(body.pesan || ""));

    if (!nama || !pesan) {
      return NextResponse.json({ error: "Nama dan pesan ulasan wajib diisi." }, { status: 400 });
    }
    if (nama.length > 50 || pesan.length > 50) {
      return NextResponse.json(
        { error: "Nama dan isi penilaian maksimal 50 huruf/karakter!" },
        { status: 400 }
      );
    }
    if (/\.php/i.test(nama) || /\.php/i.test(pesan)) {
      return NextResponse.json(
        { error: "File atau teks .php dilarang keras!" },
        { status: 403 }
      );
    }

    const created = await prisma.review.create({
      data: {
        nama,
        kategori,
        angkatan: kategori === "ppi" ? angkatan : "-",
        rating,
        pesan,
        source: body.source === "LOGOUT_ROADSHOW" ? "LOGOUT_ROADSHOW" : "LANDING",
        isVisible: true,
      },
    }).catch((err) => {
      console.warn("Prisma review create fallback to RTDB:", err);
      return {
        id: `rev_${Date.now()}`,
        nama,
        kategori,
        angkatan: kategori === "ppi" ? angkatan : "-",
        rating,
        pesan,
        source: "LANDING",
        isVisible: true,
        createdAt: new Date(),
      };
    });

    const rtdbPayload = {
      nama: created.nama,
      rating: created.rating,
      pesan: created.pesan,
      kategori: created.kategori,
      angkatan: created.angkatan,
      waktu: new Date().toLocaleString("id-ID"),
      createdAt: new Date().toISOString(),
    };

    await Promise.allSettled([
      firebasePush(ROADSHOW_RTDB_URL, "penilaian", rtdbPayload),
      firebasePush(UMUM_RTDB_URL, "penilaian", rtdbPayload),
    ]);

    return NextResponse.json({ success: true, review: created });
  }

  // 2. Protected Landing Item Creation (CMS)
  const { session, perms } = await getAuthorizedPermissions();
  if (!session) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  if (body.type === "item") {
    const section = String(body.section || "ROADSHOW_GALLERY");
    const isMerch = section === "MERCHANDISE";

    if (isMerch && !perms.manageMerchandise && !perms.manageLanding) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin dari Super Admin untuk mengelola Merchandise & Harga." },
        { status: 403 }
      );
    }
    if (!isMerch && !perms.manageLanding) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin dari Super Admin untuk menambah konten Landing Page." },
        { status: 403 }
      );
    }

    const item = await prisma.landingItem.create({
      data: {
        section,
        title: sanitizeString(String(body.title || "")),
        subtitle: sanitizeString(String(body.subtitle || "")),
        description: sanitizeString(String(body.description || "")),
        price: sanitizeString(String(body.price || "")),
        imageUrl: String(body.imageUrl || "").trim(),
        fileUrl: String(body.fileUrl || "").trim(),
        metaLocation: sanitizeString(String(body.metaLocation || "")),
        metaDay: sanitizeString(String(body.metaDay || "")),
        metaDate: sanitizeString(String(body.metaDate || "")),
        sortOrder: Number(body.sortOrder) || 0,
      },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "CREATE_LANDING_ITEM",
        details: `Menambahkan item [${section}] "${item.title}"`,
      },
    });

    return NextResponse.json({ success: true, item });
  }

  return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json();

  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  const { session, perms } = await getAuthorizedPermissions();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Update LandingConfig
  if (body.type === "config") {
    if (!perms.manageLanding && !perms.manageMerchandise) {
      return NextResponse.json({ error: "Tidak memiliki izin mengubah konfigurasi Landing Page." }, { status: 403 });
    }

    const data: Record<string, any> = {};
    if (perms.manageLanding) {
      if (body.heroTitle !== undefined) data.heroTitle = sanitizeString(String(body.heroTitle));
      if (body.heroSubtitle !== undefined) data.heroSubtitle = sanitizeString(String(body.heroSubtitle));
      if (body.heroCtaText !== undefined) data.heroCtaText = sanitizeString(String(body.heroCtaText));
      if (body.heroCtaUrl !== undefined) data.heroCtaUrl = String(body.heroCtaUrl).trim();
      if (body.bukberTitle !== undefined) data.bukberTitle = sanitizeString(String(body.bukberTitle));
      if (body.bukberDesc !== undefined) data.bukberDesc = sanitizeString(String(body.bukberDesc));
      if (body.bukberDate !== undefined) data.bukberDate = sanitizeString(String(body.bukberDate));
      if (body.bukberLocation !== undefined) data.bukberLocation = sanitizeString(String(body.bukberLocation));
      if (body.bukberHtm !== undefined) data.bukberHtm = sanitizeString(String(body.bukberHtm));
    }
    if (perms.manageMerchandise || perms.manageLanding) {
      if (body.waAdminMerch !== undefined) data.waAdminMerch = sanitizeString(String(body.waAdminMerch));
    }

    const updated = await prisma.landingConfig.update({
      where: { id: "default" },
      data,
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "UPDATE_LANDING_CONFIG",
        details: "Memperbarui konfigurasi teks utama Landing Page",
      },
    });

    return NextResponse.json({ success: true, config: updated });
  }

  // 2. Update LandingItem
  if (body.type === "item") {
    const id = String(body.id || "");
    const existing = await prisma.landingItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

    const isMerch = existing.section === "MERCHANDISE";
    if (isMerch && !perms.manageMerchandise && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin mengubah Merchandise / Harga." }, { status: 403 });
    }
    if (!isMerch && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin mengubah konten Landing Page." }, { status: 403 });
    }

    // Clean up replaced old image if a new URL is provided (BUG-HUNTER-05)
    if (body.imageUrl !== undefined && body.imageUrl !== existing.imageUrl && existing.imageUrl) {
      await deleteUploadedFile(existing.imageUrl);
    }

    const updated = await prisma.landingItem.update({
      where: { id },
      data: {
        title: body.title !== undefined ? sanitizeString(String(body.title)) : existing.title,
        subtitle: body.subtitle !== undefined ? sanitizeString(String(body.subtitle)) : existing.subtitle,
        description: body.description !== undefined ? sanitizeString(String(body.description)) : existing.description,
        price: body.price !== undefined ? sanitizeString(String(body.price)) : existing.price,
        imageUrl: body.imageUrl !== undefined ? String(body.imageUrl).trim() : existing.imageUrl,
        fileUrl: body.fileUrl !== undefined ? String(body.fileUrl).trim() : existing.fileUrl,
        metaLocation: body.metaLocation !== undefined ? sanitizeString(String(body.metaLocation)) : existing.metaLocation,
        metaDay: body.metaDay !== undefined ? sanitizeString(String(body.metaDay)) : existing.metaDay,
        metaDate: body.metaDate !== undefined ? sanitizeString(String(body.metaDate)) : existing.metaDate,
      },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "UPDATE_LANDING_ITEM",
        details: `Mengedit item [${existing.section}] "${updated.title}"`,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  }

  // 3. Update Review
  if (body.type === "review") {
    if (!perms.manageReviews && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin mengelola ulasan." }, { status: 403 });
    }
    const id = String(body.id || "");
    const updated = await prisma.review.update({
      where: { id },
      data: {
        nama: body.nama !== undefined ? sanitizeString(String(body.nama)) : undefined,
        pesan: body.pesan !== undefined ? sanitizeString(String(body.pesan)) : undefined,
        rating: body.rating !== undefined ? Math.min(5, Math.max(1, Number(body.rating))) : undefined,
        isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : undefined,
      },
    });
    return NextResponse.json({ success: true, review: updated });
  }

  return NextResponse.json({ error: "Unknown update type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const { session, perms } = await getAuthorizedPermissions();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

  if (type === "item") {
    const existing = await prisma.landingItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

    const isMerch = existing.section === "MERCHANDISE";
    if (isMerch && !perms.manageMerchandise && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin menghapus Merchandise." }, { status: 403 });
    }
    if (!isMerch && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin menghapus item Landing Page." }, { status: 403 });
    }

    await prisma.landingItem.delete({ where: { id } });

    // Clean up physical uploaded files on disk (BUG-HUNTER-05)
    await deleteUploadedFile(existing.imageUrl);
    await deleteUploadedFile(existing.fileUrl);
    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "DELETE_LANDING_ITEM",
        details: `Menghapus item [${existing.section}] "${existing.title}"`,
      },
    });
    return NextResponse.json({ success: true });
  }

  if (type === "review") {
    if (!perms.manageReviews && !perms.manageLanding) {
      return NextResponse.json({ error: "Tidak memiliki izin menghapus ulasan." }, { status: 403 });
    }
    await prisma.review.delete({ where: { id } });
    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "DELETE_REVIEW",
        details: `Menghapus ulasan ID ${id}`,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid delete type" }, { status: 400 });
}

