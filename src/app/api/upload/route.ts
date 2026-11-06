import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; folder: string };

function getCloudinaryConfig(): CloudinaryConfig | null {
  const folder = process.env.CLOUDINARY_FOLDER || "ppi-probolinggo";
  // Format tunggal: CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  const urlEnv = process.env.CLOUDINARY_URL;
  if (urlEnv) {
    const m = urlEnv.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3], folder };
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret, folder };
  return null;
}

async function uploadToCloudinary(buffer: Buffer, mime: string, cfg: CloudinaryConfig): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign = `folder=${cfg.folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + cfg.apiSecret).digest("hex");

  const form = new FormData();
  form.append("file", `data:${mime};base64,${buffer.toString("base64")}`);
  form.append("api_key", cfg.apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", cfg.folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data.secure_url as string;
}

// Helper: verify magic numbers of image buffer
function verifyImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === ".png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (ext === ".webp") {
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    return riff === "RIFF" && webp === "WEBP";
  }

  return false;
}

export async function POST(req: NextRequest) {
  const session = getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuper =
    session.role === "SUPER_ADMIN" ||
    session.userId === "master_superadmin_01" ||
    session.username === "aditya" ||
    session.username === "superadmin";

  let isAllowed = isSuper;

  if (!isSuper) {
    const dbUser = await prisma.userAccount.findFirst({
      where: {
        OR: [{ id: session.userId }, { username: session.username }],
      },
    });
    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let perms: Record<string, boolean> = {};
    try {
      perms = JSON.parse(dbUser.permissions || "{}");
    } catch {
      perms = {};
    }

    isAllowed =
      (dbUser.role as string) === "SUPER_ADMIN" ||
      Boolean(perms.manageLanding) ||
      Boolean(perms.manageMerchandise) ||
      Boolean(perms.manageRoadshow);
  }

  if (!isAllowed) {
    return NextResponse.json({ error: "Tidak memiliki izin upload gambar." }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File gambar tidak ditemukan." }, { status: 400 });
    }

    // 1. Strict File Size Clamp (BUG-HUNTER-02: DoS & Disk Flood Prevention)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar! Maksimal ukuran gambar adalah 5 MB (File Anda: ${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    const lowerName = file.name.toLowerCase();
    // 2. Strict Extension & Double Extension Inspection
    if (
      lowerName.includes(".php") ||
      lowerName.includes(".phtml") ||
      lowerName.includes(".phar") ||
      lowerName.includes(".asp") ||
      lowerName.includes(".jsp") ||
      lowerName.includes(".exe") ||
      lowerName.includes(".sh")
    ) {
      return NextResponse.json(
        { error: "SECURITY BLOCK: File script / executable dilarang keras diunggah ke server!" },
        { status: 403 }
      );
    }

    const ext = path.extname(lowerName);
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json(
        { error: "Hanya file gambar murni (JPG, JPEG, PNG, WEBP) yang diizinkan." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Verify Genuine Magic Bytes
    if (!verifyImageMagicBytes(buffer, ext)) {
      return NextResponse.json(
        { error: "SECURITY BLOCK: Header biner file tidak sesuai dengan format gambar valid (File corrupt atau spoofed extension)!" },
        { status: 400 }
      );
    }

    // 4. Deep Buffer Inspection for Webshell Payloads (Scans Entire File, not just 512 bytes)
    const rawContent = buffer.toString("binary").toLowerCase();
    const dangerousPatterns = [
      "<?php",
      "<?=",
      "<script",
      "<svg",
      "eval(",
      "base64_decode(",
      "passthru(",
      "shell_exec(",
      "system(",
      "onload=",
      "onerror=",
    ];

    for (const pattern of dangerousPatterns) {
      if (rawContent.includes(pattern)) {
        await prisma.securityAuditLog.create({
          data: {
            actorName: session.fullName,
            actorRole: session.role,
            action: "UPLOAD_PAYLOAD_BLOCKED",
            details: `Pola berbahaya "${pattern}" ditemukan di dalam payload upload file "${file.name}"`,
          },
        });
        return NextResponse.json(
          { error: `SECURITY BLOCK: Terdeteksi script atau payload berbahaya (${pattern}) di dalam gambar!` },
          { status: 403 }
        );
      }
    }

    // 5. Simpan gambar ke Cloudinary jika dikonfigurasi
    const cloudinary = getCloudinaryConfig();
    if (cloudinary) {
      try {
        const url = await uploadToCloudinary(buffer, file.type, cloudinary);
        return NextResponse.json({ success: true, url });
      } catch (cloudErr: any) {
        console.error("Cloudinary upload failed, falling back to database storage:", cloudErr);
      }
    }

    // 6. Simpan gambar ke database cloud (UploadedImage di TiDB)
    // Berfungsi 100% andal di Vercel, VPS, maupun lokal tanpa membutuhkan akun Cloudinary eksternal
    try {
      const saved = await prisma.uploadedImage.create({
        data: {
          mimeType: file.type || "image/jpeg",
          fileName: file.name || "image.jpg",
          data: buffer.toString("base64"),
          size: buffer.length,
        },
      });

      return NextResponse.json({
        success: true,
        url: `/api/uploads/${saved.id}`,
      });
    } catch (dbErr: any) {
      console.error("Database image storage error:", dbErr);
    }

    // 7. Fallback penyimpanan lokal jika lingkungan mendukung filesystem persisten
    try {
      const safeExt = ext === ".jpeg" ? ".jpg" : ext;
      const safeName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${safeExt}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, safeName);
      await writeFile(filePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${safeName}`,
      });
    } catch (fsErr: any) {
      return NextResponse.json(
        { error: "Gagal menyimpan file gambar ke server." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Gagal mengunggah gambar: " + (err?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
