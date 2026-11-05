import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import {
  getServerSession,
  inspectPayloadForAttacks,
  RolePermissions,
  sanitizeString,
  signSchoolQrToken,
  verifySchoolQrToken,
} from "@/lib/security";
import { firebaseDelete, firebasePush, firebasePut, ROADSHOW_RTDB_URL } from "@/lib/firebase";

function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getRoadshowAccess() {
  const session = getServerSession();
  if (!session) {
    return {
      session: null,
      isAdminRoadshow: false,
      isUserRoadshow: false,
      canInputBB: false,
      canInputTB: false,
      canInputRegistrasi: false,
    };
  }

  const dbUser = await prisma.userAccount.findUnique({ where: { id: session.userId } });
  if (!dbUser || !dbUser.isActive) {
    return {
      session: null,
      isAdminRoadshow: false,
      isUserRoadshow: false,
      canInputBB: false,
      canInputTB: false,
      canInputRegistrasi: false,
    };
  }

  if (dbUser.role === "SUPER_ADMIN") {
    return {
      session: { ...session, role: "SUPER_ADMIN" as const, assignedSchoolId: dbUser.assignedSchoolId },
      isAdminRoadshow: true,
      isUserRoadshow: true,
      canInputBB: true,
      canInputTB: true,
      canInputRegistrasi: true,
    };
  }

  let perms: RolePermissions = {};
  try {
    perms = JSON.parse(dbUser.permissions || "{}");
  } catch {
    perms = {};
  }

  // Penjab Roadshow can be role PENJAB_ROADSHOW, ADMIN with manageRoadshow, or any ADMIN
  const isAdminRoadshow =
    dbUser.role === "PENJAB_ROADSHOW" ||
    (dbUser.role === "ADMIN" && (Boolean(perms.manageRoadshow) || perms.manageLanding !== false));

  // Every Panitia (USER) or Admin Roadshow gets full access to Registrasi, Tabel BB, and Tabel TB once QR is scanned
  const canInputBB = true;
  const canInputTB = true;
  const canInputRegistrasi = true;
  const isUserRoadshow = dbUser.role === "USER" || dbUser.role === "PENJAB_ROADSHOW" || isAdminRoadshow;

  return {
    session: {
      ...session,
      role: dbUser.role as "ADMIN" | "USER",
      permissions: perms,
      assignedSchoolId: dbUser.assignedSchoolId,
    },
    isAdminRoadshow,
    isUserRoadshow,
    canInputBB,
    canInputTB,
    canInputRegistrasi,
  };
}

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "public";
  const schoolId = searchParams.get("schoolId");

  // =========================================================================
  // MODE: PUBLIC (/roadshow)
  // Only returns Schools + Candidates that PASSED (hasilLulus: true) and are PUBLISHED (statusTayang: true)
  // Plus all official Roadshow Posts (Sudah Dikunjungi & Akan Dikunjungi)
  // =========================================================================
  if (mode === "public") {
    const [schools, allSchoolsForSchedule, posts] = await Promise.all([
      prisma.roadshowSchool.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          candidates: {
            where: {
              hasilLulus: true,
              statusTayang: true,
            },
            orderBy: { nama: "asc" },
            select: {
              id: true,
              kodePeserta: true,
              nama: true,
              jenisKelamin: true,
              schoolId: true,
              hasilLulus: true,
              statusTayang: true,
              keterangan: true,
            },
          },
        },
      }),
      prisma.roadshowSchool.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          namaSekolah: true,
          lokasi: true,
          tanggal: true,
          statusPenilaian: true,
          sortOrder: true,
          documentationPhoto: true,
          documentationTitle: true,
          documentationDate: true,
          documentationLocation: true,
        },
      }),
      prisma.roadshowPost.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
    ]);

    return NextResponse.json({
      schools: schools.map((s) => ({
        id: s.id,
        namaSekolah: s.namaSekolah,
        lokasi: s.lokasi,
        tanggal: s.tanggal,
        statusPenilaian: s.statusPenilaian,
        sortOrder: s.sortOrder,
        passedCount: s.candidates.length,
        candidates: s.candidates,
      })),
      schedule: allSchoolsForSchedule,
      posts,
    });
  }

  // =========================================================================
  // MODE: POSTS (/api/roadshow?mode=posts)
  // =========================================================================
  if (mode === "posts") {
    const status = searchParams.get("status");
    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    const posts = await prisma.roadshowPost.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ posts });
  }

  // =========================================================================
  // MODE: INTERNAL (/ppi-roadshow-27)
  // Requires authenticated Super Admin, Admin Roadshow, or User Roadshow
  // =========================================================================
  const {
    session,
    isAdminRoadshow,
    isUserRoadshow,
    canInputBB,
    canInputTB,
    canInputRegistrasi,
  } = await getRoadshowAccess();
  if (!session || (!isAdminRoadshow && !isUserRoadshow)) {
    return NextResponse.json(
      { error: "Akses ditolak. Anda tidak memiliki penugasan untuk modul Roadshow." },
      { status: 403 }
    );
  }

  let schools = await prisma.roadshowSchool.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
  });

  // Ensure exactly one school is designated as "Hari Ini" (Sekolah Kunjungan Hari Ini) if none is set yet
  let todaySchool = schools.find((s) => s.statusPenilaian === "Hari Ini");
  if (!todaySchool && schools.length > 0) {
    // Pick the last school (most recent, e.g. SMA HATI) as default today's school and lock the rest
    const fallbackToday = schools[schools.length - 1];
    await prisma.roadshowSchool.updateMany({
      where: { id: { not: fallbackToday.id } },
      data: { statusPenilaian: "Ditutup" },
    });
    await prisma.roadshowSchool.update({
      where: { id: fallbackToday.id },
      data: { statusPenilaian: "Hari Ini" },
    });
    schools = schools.map((s) => ({
      ...s,
      statusPenilaian: s.id === fallbackToday.id ? "Hari Ini" : "Ditutup",
    }));
    todaySchool = schools[schools.length - 1];
  }

  // STRICT QR SCAN ENFORCEMENT FOR FIELD COMMITTEE (PANITIA):
  // Field officers (!isAdminRoadshow) MUST scan Super Admin's QR code for a valid school first!
  const hasAssignedValidSchool = Boolean(
    session.assignedSchoolId && schools.some((s) => s.id === session.assignedSchoolId)
  );
  const qrVerified = isAdminRoadshow || hasAssignedValidSchool;

  if (!qrVerified) {
    return NextResponse.json({
      schools: [],
      activeSchoolId: "",
      todaySchoolId: todaySchool?.id || "",
      candidates: [],
      qrVerified: false,
      access: {
        role: session.role,
        isAdminRoadshow: false,
        isUserRoadshow: true,
        canInputBB: true,
        canInputTB: true,
        canInputRegistrasi: true,
        assignedSchoolId: null,
      },
    });
  }

  const assignedSchool = session.assignedSchoolId
    ? schools.find((s) => s.id === session.assignedSchoolId)
    : null;

  const effectiveSchoolId = isAdminRoadshow
    ? schoolId || session.assignedSchoolId || todaySchool?.id || schools[0]?.id || ""
    : assignedSchool?.id || todaySchool?.id || schools[0]?.id || "";

  const visibleSchools = isAdminRoadshow
    ? schools.map((s) => ({
        ...s,
        qrPayload: signSchoolQrToken(s.id, s.namaSekolah),
      }))
    : schools.filter((s) => s.id === effectiveSchoolId);

  const candidates = effectiveSchoolId
    ? await prisma.roadshowCandidate.findMany({
        where: { schoolId: effectiveSchoolId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return NextResponse.json({
    schools: visibleSchools,
    activeSchoolId: effectiveSchoolId,
    todaySchoolId: todaySchool?.id || "",
    candidates,
    qrVerified: true,
    access: {
      role: session.role,
      isAdminRoadshow,
      isUserRoadshow,
      canInputBB,
      canInputTB,
      canInputRegistrasi,
      assignedSchoolId: session.assignedSchoolId,
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json();

  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  const { session, isAdminRoadshow, canInputRegistrasi } = await getRoadshowAccess();
  if (!session) {
    return NextResponse.json({ error: "Silakan login di portal /ppi-roadshow-27 terlebih dahulu." }, { status: 401 });
  }

  const action = body.action;

  // 0. Verify Scanned Super Admin QR Code (Blocks any non-Super-Admin QR!)
  if (action === "verify_school_qr") {
    const rawQr = String(body.qrData || "").trim();
    const verification = verifySchoolQrToken(rawQr);

    if (!verification.valid || !verification.schoolId) {
      await prisma.securityAuditLog.create({
        data: {
          actorName: session.fullName,
          actorRole: session.role,
          action: "QR_SCAN_BLOCKED",
          details: verification.reason || "Scan QR tidak resmi ditolak",
        },
      });
      return NextResponse.json(
        {
          error:
            verification.reason ||
            "AKSES DIBLOKIR! Barcode/QR tersebut BUKAN QR resmi dari Super Admin PPI!",
        },
        { status: 403 }
      );
    }

    const school = await prisma.roadshowSchool.findUnique({
      where: { id: verification.schoolId },
    });

    if (!school) {
      return NextResponse.json(
        { error: "Sekolah pada QR tidak ditemukan di database." },
        { status: 404 }
      );
    }

    await prisma.userAccount.update({
      where: { id: session.userId },
      data: { assignedSchoolId: school.id },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "QR_SCAN_SUCCESS",
        details: `Berhasil scan QR Super Admin untuk sekolah: ${school.namaSekolah}`,
      },
    });

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        namaSekolah: school.namaSekolah,
      },
    });
  }

  // 1. Add New School (Super Admin or Admin Roadshow) -> Auto-becomes Today's School + Generates QR!
  if (action === "create_school") {
    if (!isAdminRoadshow) {
      return NextResponse.json(
        { error: "Hanya Super Admin atau Admin Roadshow yang dapat menambahkan sekolah baru." },
        { status: 403 }
      );
    }

    const namaSekolah = sanitizeString(String(body.namaSekolah || "")).toUpperCase();
    const lokasi = sanitizeString(String(body.lokasi || "Kab. Probolinggo"));
    const tanggal = sanitizeString(String(body.tanggal || new Date().toLocaleDateString("id-ID")));

    if (!namaSekolah) {
      return NextResponse.json({ error: "Nama sekolah wajib diisi." }, { status: 400 });
    }

    // Lock all previous schools to "Ditutup" and set the newly created school to "Hari Ini"
    await prisma.roadshowSchool.updateMany({
      data: { statusPenilaian: "Ditutup" },
    });

    const fbKey = await firebasePush(ROADSHOW_RTDB_URL, "sekolah", {
      namaSekolah,
      statusPenilaian: "Hari Ini",
    });

    const created = await prisma.roadshowSchool.create({
      data: {
        firebaseKey: fbKey || undefined,
        namaSekolah,
        lokasi,
        tanggal,
        statusPenilaian: "Hari Ini",
      },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "CREATE_ROADSHOW_SCHOOL",
        details: `Menambahkan sekolah baru & membuat QR: ${namaSekolah}`,
      },
    });

    return NextResponse.json({
      success: true,
      school: {
        ...created,
        qrPayload: signSchoolQrToken(created.id, created.namaSekolah),
      },
    });
  }

  // 2. Register Candidate inside Isolated School Workspace
  if (action === "register_candidate") {
    if (!canInputRegistrasi && !isAdminRoadshow) {
      return NextResponse.json(
        { error: "Akun Anda hanya ditugaskan untuk bagian pengukuran (bukan bagian Registrasi Peserta)." },
        { status: 403 }
      );
    }

    const schoolId = String(body.schoolId || "");
    const nama = sanitizeString(String(body.nama || ""));
    const jenisKelamin = body.jenisKelamin === "Cewek" ? "Cewek" : "Cowok";

    if (!schoolId || !nama) {
      return NextResponse.json({ error: "Sekolah dan nama peserta wajib diisi." }, { status: 400 });
    }

    const school = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }
    if (!isAdminRoadshow) {
      if (session.assignedSchoolId !== school.id) {
        return NextResponse.json(
          { error: "Wajib Scan QR Code Resmi Super Admin terlebih dahulu untuk membuka akses sekolah ini!" },
          { status: 403 }
        );
      }
    }

    const kodePeserta = generateRandomCode();
    const fbKey = await firebasePush(ROADSHOW_RTDB_URL, "peserta", {
      idSekolah: school.firebaseKey || school.id,
      nama,
      jenisKelamin,
      kodePeserta,
    });

    const candidate = await prisma.roadshowCandidate.create({
      data: {
        firebaseKey: fbKey || undefined,
        kodePeserta,
        nama,
        jenisKelamin,
        schoolId: school.id,
        updatedBy: session.fullName,
      },
    });

    return NextResponse.json({ success: true, candidate });
  }

  // 3. Deactivate School with Mandatory Documentation (Photo, Title, Location, Date)
  if (action === "deactivate_school_with_documentation") {
    if (!isAdminRoadshow) {
      return NextResponse.json(
        { error: "Hanya Super Admin atau Penjab Roadshow yang dapat menutup sesi sekolah." },
        { status: 403 }
      );
    }

    const schoolId = String(body.schoolId || "");
    const photoUrl = String(body.photoUrl || "").trim();
    const namaKegiatan = sanitizeString(String(body.namaKegiatan || "")).trim();
    const lokasi = sanitizeString(String(body.lokasi || "")).trim();
    const tanggal = sanitizeString(String(body.tanggal || "")).trim();

    if (!schoolId) {
      return NextResponse.json({ error: "ID sekolah wajib diisi." }, { status: 400 });
    }
    if (!photoUrl || !namaKegiatan || !lokasi || !tanggal) {
      return NextResponse.json(
        {
          error:
            "Wajib mengunggah minimal 1 foto dokumentasi, nama kegiatan, lokasi, dan tanggal sebelum menonaktifkan sesi sekolah!",
        },
        { status: 400 }
      );
    }

    const school = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }

    const updatedSchool = await prisma.roadshowSchool.update({
      where: { id: schoolId },
      data: {
        statusPenilaian: "Ditutup",
        documentationPhoto: photoUrl,
        documentationTitle: namaKegiatan,
        documentationDate: tanggal,
        documentationLocation: lokasi,
        closedAt: new Date(),
      },
    });

    // Otomatis terbitkan ke Kegiatan PPI Roadshow di Landing Page (ROADSHOW_GALLERY)
    const galleryItem = await prisma.landingItem.create({
      data: {
        section: "ROADSHOW_GALLERY",
        title: namaKegiatan,
        imageUrl: photoUrl,
        metaLocation: lokasi,
        metaDay: "Roadshow Resmi",
        metaDate: tanggal,
        description: `Dokumentasi resmi penutupan roadshow seleksi Paskibraka di ${school.namaSekolah}.`,
        sortOrder: 0,
      },
    });

    // Otomatis terbitkan ke Berita & Dokumentasi Roadshow (SUDAH_DIKUNJUNGI)
    await prisma.roadshowPost.create({
      data: {
        title: namaKegiatan,
        category: "Kunjungan Selesai",
        status: "SUDAH_DIKUNJUNGI",
        schoolId: school.id,
        schoolName: school.namaSekolah,
        location: lokasi,
        date: tanggal,
        imageUrl: photoUrl,
        summary: `Roadshow pengukuran fisik dan sosialisasi di ${school.namaSekolah} telah selesai dilaksanakan dengan sukses.`,
        content: `Kegiatan roadshow resmi PPI Kabupaten Probolinggo di ${school.namaSekolah} telah ditutup. Seluruh data peserta telah terekam dalam sistem digital dan verifikasi calon kandidat pra-seleksi siap diterbitkan.`,
        sortOrder: 0,
        isPublished: true,
        author: session.fullName,
      },
    }).catch(() => {});

    if (school.firebaseKey) {
      await firebasePut(ROADSHOW_RTDB_URL, `sekolah/${school.firebaseKey}`, {
        namaSekolah: school.namaSekolah,
        statusPenilaian: "Ditutup",
      });
    }

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "DEACTIVATE_SCHOOL_WITH_DOCS",
        details: `Menutup sesi roadshow ${school.namaSekolah} & menerbitkan foto dokumentasi ke Landing Page`,
      },
    });

    return NextResponse.json({
      success: true,
      school: updatedSchool,
      galleryItem,
    });
  }

  // 4. Create Roadshow Post (Berita & Agenda Kunjungan - Penjab Roadshow & Super Admin)
  if (action === "create_post") {
    if (!isAdminRoadshow) {
      return NextResponse.json(
        { error: "Hanya Penjab Roadshow atau Super Admin yang dapat membuat berita." },
        { status: 403 }
      );
    }
    const title = sanitizeString(String(body.title || "")).trim();
    if (!title) {
      return NextResponse.json({ error: "Judul berita wajib diisi." }, { status: 400 });
    }

    const postStatus = body.status === "AKAN_DIKUNJUNGI" ? "AKAN_DIKUNJUNGI" : "SUDAH_DIKUNJUNGI";

    const post = await prisma.roadshowPost.create({
      data: {
        title,
        category: sanitizeString(String(body.category || "Kunjungan Sekolah")),
        status: postStatus,
        schoolId: body.schoolId ? String(body.schoolId) : null,
        schoolName: sanitizeString(String(body.schoolName || "")),
        location: sanitizeString(String(body.location || "Kab. Probolinggo")),
        date: sanitizeString(String(body.date || "")),
        imageUrl: postStatus === "AKAN_DIKUNJUNGI" ? "" : String(body.imageUrl || "").trim(),
        summary: sanitizeString(String(body.summary || ""), 1500),
        content: sanitizeString(String(body.content || ""), 8000),
        isPublished: body.isPublished !== false,
        author: session.fullName,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });

    return NextResponse.json({ success: true, post });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json();

  const waf = inspectPayloadForAttacks(body);
  if (!waf.safe) {
    return NextResponse.json({ error: waf.reason }, { status: 403 });
  }

  const { session, isAdminRoadshow, isUserRoadshow, canInputBB, canInputTB } = await getRoadshowAccess();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = body.action;

  // 1. Input / Update Berat Badan (BB) & Tinggi Badan (TB) - Strictly enforced by assigned task!
  if (action === "update_bb_tb") {
    if (!isUserRoadshow && !isAdminRoadshow) {
      return NextResponse.json({ error: "Tidak memiliki izin input BB & TB." }, { status: 403 });
    }
    if (body.beratBadan !== undefined && !canInputBB) {
      return NextResponse.json(
        { error: "Akun Anda hanya ditugaskan untuk bagian Tinggi Badan (TB), tidak dapat mengubah Berat Badan (BB)." },
        { status: 403 }
      );
    }
    if (body.tinggiBadan !== undefined && !canInputTB) {
      return NextResponse.json(
        { error: "Akun Anda hanya ditugaskan untuk bagian Berat Badan (BB), tidak dapat mengubah Tinggi Badan (TB)." },
        { status: 403 }
      );
    }

    const candidateId = String(body.candidateId || "");
    const candidate = await prisma.roadshowCandidate.findUnique({
      where: { id: candidateId },
      include: { school: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
    }

    if (!isAdminRoadshow) {
      if (
        session.assignedSchoolId !== candidate.schoolId ||
        candidate.school.statusPenilaian !== "Hari Ini"
      ) {
        return NextResponse.json(
          { error: "Wajib Scan QR Code Resmi Super Admin terlebih dahulu untuk menginput BB / TB!" },
          { status: 403 }
        );
      }
    }

    let beratBadan = candidate.beratBadan;
    if (body.beratBadan !== undefined) {
      const parsedBB = Number(body.beratBadan);
      if (isNaN(parsedBB) || parsedBB < 0) {
        return NextResponse.json({ error: "Format Berat Badan (BB) tidak valid." }, { status: 400 });
      }
      // Input range clamping (BUG-HUNTER-06: 20 kg - 250 kg or 0 for reset)
      if (parsedBB > 0 && (parsedBB < 20 || parsedBB > 250)) {
        return NextResponse.json(
          { error: "Nilai Berat Badan (BB) harus realistis antara 20 kg sampai 250 kg (atau 0 untuk mengosongkan)." },
          { status: 400 }
        );
      }
      beratBadan = parsedBB;
    }

    let tinggiBadan = candidate.tinggiBadan;
    if (body.tinggiBadan !== undefined) {
      const parsedTB = Number(body.tinggiBadan);
      if (isNaN(parsedTB) || parsedTB < 0) {
        return NextResponse.json({ error: "Format Tinggi Badan (TB) tidak valid." }, { status: 400 });
      }
      // Input range clamping (BUG-HUNTER-06: 100 cm - 250 cm or 0 for reset)
      if (parsedTB > 0 && (parsedTB < 100 || parsedTB > 250)) {
        return NextResponse.json(
          { error: "Nilai Tinggi Badan (TB) harus realistis antara 100 cm sampai 250 cm (atau 0 untuk mengosongkan)." },
          { status: 400 }
        );
      }
      tinggiBadan = parsedTB;
    }

    // Auto-calculate kelulusan based on school's gender thresholds
    let hasilLulus = candidate.hasilLulus;
    if (beratBadan > 0 && tinggiBadan > 0) {
      const s = candidate.school;
      if (candidate.jenisKelamin === "Cewek") {
        hasilLulus =
          beratBadan >= s.minBeratCewek &&
          beratBadan <= s.maxBeratCewek &&
          tinggiBadan >= s.minTinggiCewek &&
          tinggiBadan <= s.maxTinggiCewek;
      } else {
        hasilLulus =
          beratBadan >= s.minBeratCowok &&
          beratBadan <= s.maxBeratCowok &&
          tinggiBadan >= s.minTinggiCowok &&
          tinggiBadan <= s.maxTinggiCowok;
      }
    }

    const updateData: Record<string, any> = {
      beratBadan,
      tinggiBadan,
      hasilLulus,
      updatedBy: session.fullName,
    };
    if (body.keterangan !== undefined) {
      updateData.keterangan = sanitizeString(String(body.keterangan));
    }

    const updated = await prisma.roadshowCandidate.update({
      where: { id: candidateId },
      data: updateData,
    });

    // Sync to Firebase Roadshow DB
    const fbRefKey = candidate.firebaseKey || candidate.id;
    await firebasePut(ROADSHOW_RTDB_URL, `penilaian/pen_${fbRefKey}`, {
      idPeserta: fbRefKey,
      beratBadan,
      tinggiBadan,
      hasilLulus,
      statusTayang: updated.statusTayang,
      keterangan: updated.keterangan,
      adminInput: session.fullName,
      lastUpdate: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, candidate: updated });
  }

  // 2. Candidate Updates (Admin Roadshow & Panitia User)
  if (action === "admin_update_candidate" || action === "update_candidate") {
    const candidateId = String(body.candidateId || "");
    const existing = await prisma.roadshowCandidate.findUnique({
      where: { id: candidateId },
      include: { school: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
    }

    if (!isAdminRoadshow && session.assignedSchoolId !== existing.schoolId) {
      return NextResponse.json(
        { error: "Anda hanya memiliki akses untuk memperbarui data peserta di sekolah penugasan Anda." },
        { status: 403 }
      );
    }

    let beratBadan = existing.beratBadan;
    if (body.beratBadan !== undefined) {
      const parsedBB = Number(body.beratBadan);
      if (!isNaN(parsedBB) && parsedBB >= 0) beratBadan = parsedBB;
    }

    let tinggiBadan = existing.tinggiBadan;
    if (body.tinggiBadan !== undefined) {
      const parsedTB = Number(body.tinggiBadan);
      if (!isNaN(parsedTB) && parsedTB >= 0) tinggiBadan = parsedTB;
    }

    // Auto calculate lulus if measurements updated
    let hasilLulus = existing.hasilLulus;
    if (beratBadan > 0 && tinggiBadan > 0) {
      const s = existing.school;
      const gender = body.jenisKelamin || existing.jenisKelamin;
      if (gender === "Cewek") {
        hasilLulus =
          beratBadan >= s.minBeratCewek &&
          beratBadan <= s.maxBeratCewek &&
          tinggiBadan >= s.minTinggiCewek &&
          tinggiBadan <= s.maxTinggiCewek;
      } else {
        hasilLulus =
          beratBadan >= s.minBeratCowok &&
          beratBadan <= s.maxBeratCowok &&
          tinggiBadan >= s.minTinggiCowok &&
          tinggiBadan <= s.maxTinggiCowok;
      }
    }

    if (isAdminRoadshow && body.hasilLulus !== undefined) {
      hasilLulus = Boolean(body.hasilLulus);
    }

    const updated = await prisma.roadshowCandidate.update({
      where: { id: candidateId },
      data: {
        nama: body.nama !== undefined ? sanitizeString(String(body.nama)) : existing.nama,
        jenisKelamin:
          body.jenisKelamin !== undefined
            ? body.jenisKelamin === "Cewek"
              ? "Cewek"
              : "Cowok"
            : existing.jenisKelamin,
        beratBadan,
        tinggiBadan,
        hasilLulus,
        statusTayang:
          isAdminRoadshow && body.statusTayang !== undefined
            ? Boolean(body.statusTayang)
            : existing.statusTayang,
        keterangan: body.keterangan !== undefined ? sanitizeString(String(body.keterangan)) : existing.keterangan,
        updatedBy: session.fullName,
      },
    });

    const fbRefKey = existing.firebaseKey || existing.id;
    await firebasePut(ROADSHOW_RTDB_URL, `penilaian/pen_${fbRefKey}`, {
      idPeserta: fbRefKey,
      beratBadan: updated.beratBadan,
      tinggiBadan: updated.tinggiBadan,
      hasilLulus: updated.hasilLulus,
      statusTayang: updated.statusTayang,
      keterangan: updated.keterangan,
      adminInput: session.fullName,
      lastUpdate: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true, candidate: updated });
  }

  // 3. Bulk Publish / Unpublish School Results to /roadshow
  if (action === "bulk_tayang_school") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Admin Roadshow / Super Admin." }, { status: 403 });
    }
    const schoolId = String(body.schoolId || "");
    const statusTayang = Boolean(body.statusTayang);

    await prisma.roadshowCandidate.updateMany({
      where: { schoolId },
      data: { statusTayang },
    });

    return NextResponse.json({ success: true });
  }

  // 4. Set Active School for Today ("Jadikan Sekolah Kunjungan Hari Ini") - Super Admin / Admin Roadshow
  if (action === "set_active_school_today") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Super Admin / Admin Roadshow." }, { status: 403 });
    }
    const schoolId = String(body.schoolId || "");
    const targetSchool = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!targetSchool) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }

    // Lock all other schools to "Ditutup" and set ONLY this school to "Hari Ini"
    await prisma.roadshowSchool.updateMany({
      where: { id: { not: schoolId } },
      data: { statusPenilaian: "Ditutup" },
    });
    await prisma.roadshowSchool.update({
      where: { id: schoolId },
      data: { statusPenilaian: "Hari Ini" },
    });

    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "SET_TODAY_SCHOOL",
        details: `Menetapkan ${targetSchool.namaSekolah} sebagai Sekolah Kunjungan Hari Ini (sekolah lain dikunci untuk petugas)`,
      },
    });

    return NextResponse.json({ success: true });
  }

  // 4b. Manual Toggle / Aktifkan / Matikan Sekolah Secara Manual (Super Admin & Admin Roadshow)
  if (action === "toggle_school_status") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Super Admin atau Admin Roadshow." }, { status: 403 });
    }
    const schoolId = String(body.schoolId || "");
    const newStatus = body.status === "Hari Ini" ? "Hari Ini" : "Ditutup";

    const targetSchool = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!targetSchool) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }

    if (newStatus === "Hari Ini") {
      await prisma.roadshowSchool.updateMany({
        where: { id: { not: schoolId } },
        data: { statusPenilaian: "Ditutup" },
      });
    }

    const updated = await prisma.roadshowSchool.update({
      where: { id: schoolId },
      data: { statusPenilaian: newStatus },
    });

    if (targetSchool.firebaseKey) {
      await firebasePut(ROADSHOW_RTDB_URL, `sekolah/${targetSchool.firebaseKey}`, {
        namaSekolah: targetSchool.namaSekolah,
        statusPenilaian: newStatus,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, school: updated });
  }

  // 5. Toggle School Status / Thresholds
  if (action === "update_school") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Admin Roadshow / Super Admin." }, { status: 403 });
    }
    const schoolId = String(body.schoolId || "");
    const existing = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!existing) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });

    const updated = await prisma.roadshowSchool.update({
      where: { id: schoolId },
      data: {
        namaSekolah: body.namaSekolah !== undefined ? sanitizeString(String(body.namaSekolah)).toUpperCase() : existing.namaSekolah,
        lokasi: body.lokasi !== undefined ? sanitizeString(String(body.lokasi)) : existing.lokasi,
        tanggal: body.tanggal !== undefined ? sanitizeString(String(body.tanggal)) : existing.tanggal,
        statusPenilaian:
          body.statusPenilaian !== undefined
            ? body.statusPenilaian === "Ditutup"
              ? "Ditutup"
              : "Dibuka"
            : existing.statusPenilaian,
      },
    });

    if (existing.firebaseKey) {
      await firebasePut(ROADSHOW_RTDB_URL, `sekolah/${existing.firebaseKey}`, {
        namaSekolah: updated.namaSekolah,
        statusPenilaian: updated.statusPenilaian,
      });
    }

    return NextResponse.json({ success: true, school: updated });
  }

  // 6. Update Official Roadshow Schedule (Date, Order, Location, Status)
  if (action === "update_schedule") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Super Admin atau Penjab Roadshow." }, { status: 403 });
    }
    const schoolId = String(body.schoolId || "");
    const existing = await prisma.roadshowSchool.findUnique({ where: { id: schoolId } });
    if (!existing) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });

    const updateData: Record<string, any> = {};
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder) || 0;
    if (body.tanggal !== undefined) updateData.tanggal = sanitizeString(String(body.tanggal));
    if (body.lokasi !== undefined) updateData.lokasi = sanitizeString(String(body.lokasi));
    if (body.statusPenilaian !== undefined) {
      const sp = sanitizeString(String(body.statusPenilaian));
      if (["Dibuka", "Ditutup", "Hari Ini", "Akan Datang"].includes(sp)) {
        updateData.statusPenilaian = sp;
      }
    }

    const updated = await prisma.roadshowSchool.update({
      where: { id: schoolId },
      data: updateData,
    });

    return NextResponse.json({ success: true, school: updated });
  }

  // 7. Update Roadshow Post (Berita / Agenda Kunjungan)
  if (action === "update_post") {
    if (!isAdminRoadshow) {
      return NextResponse.json(
        { error: "Hanya Penjab Roadshow atau Super Admin yang dapat mengubah berita." },
        { status: 403 }
      );
    }
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "ID berita wajib diisi." }, { status: 400 });

    const postStatus = body.status === "AKAN_DIKUNJUNGI" ? "AKAN_DIKUNJUNGI" : "SUDAH_DIKUNJUNGI";

    const post = await prisma.roadshowPost.update({
      where: { id },
      data: {
        title: sanitizeString(String(body.title || "")),
        category: sanitizeString(String(body.category || "Kunjungan Sekolah")),
        status: postStatus,
        schoolId: body.schoolId ? String(body.schoolId) : null,
        schoolName: sanitizeString(String(body.schoolName || "")),
        location: sanitizeString(String(body.location || "Kab. Probolinggo")),
        date: sanitizeString(String(body.date || "")),
        imageUrl: postStatus === "AKAN_DIKUNJUNGI" ? "" : String(body.imageUrl || "").trim(),
        summary: sanitizeString(String(body.summary || ""), 1500),
        content: sanitizeString(String(body.content || ""), 8000),
        isPublished: body.isPublished !== false,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });

    return NextResponse.json({ success: true, post });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const { session, isAdminRoadshow, isUserRoadshow } = await getRoadshowAccess();
  if (!session || (!isAdminRoadshow && !isUserRoadshow)) {
    return NextResponse.json(
      { error: "Akses ditolak." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

  if (type === "post") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Super Admin atau Admin Roadshow." }, { status: 403 });
    }
    const existing = await prisma.roadshowPost.findUnique({ where: { id } });
    if (existing) {
      await prisma.roadshowPost.delete({ where: { id } });
      await prisma.securityAuditLog.create({
        data: {
          actorName: session.fullName,
          actorRole: session.role,
          action: "DELETE_ROADSHOW_POST",
          details: `Menghapus berita roadshow "${existing.title}"`,
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  if (type === "candidate") {
    const existing = await prisma.roadshowCandidate.findUnique({ where: { id } });
    if (existing) {
      if (!isAdminRoadshow && session.assignedSchoolId !== existing.schoolId) {
        return NextResponse.json({ error: "Anda hanya dapat menghapus peserta di sekolah penugasan Anda." }, { status: 403 });
      }
      await prisma.roadshowCandidate.delete({ where: { id } });
      if (existing.firebaseKey) {
        await firebaseDelete(ROADSHOW_RTDB_URL, `peserta/${existing.firebaseKey}`).catch(() => {});
        await firebaseDelete(ROADSHOW_RTDB_URL, `penilaian/pen_${existing.firebaseKey}`).catch(() => {});
      }
    }
    return NextResponse.json({ success: true });
  }

  if (type === "school") {
    if (!isAdminRoadshow) {
      return NextResponse.json({ error: "Khusus Super Admin atau Admin Roadshow." }, { status: 403 });
    }
    const existing = await prisma.roadshowSchool.findUnique({ where: { id } });
    if (existing) {
      await prisma.roadshowSchool.delete({ where: { id } });
      if (existing.firebaseKey) {
        await firebaseDelete(ROADSHOW_RTDB_URL, `sekolah/${existing.firebaseKey}`).catch(() => {});
      }
    }
    await prisma.securityAuditLog.create({
      data: {
        actorName: session.fullName,
        actorRole: session.role,
        action: "DELETE_ROADSHOW_SCHOOL",
        details: `Menghapus sekolah ${existing?.namaSekolah || id}`,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid delete type" }, { status: 400 });
}


export const dynamic = "force-dynamic";
export const revalidate = 0;

