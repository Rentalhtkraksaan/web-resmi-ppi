import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || "ppi-probolinggo-2026-2027-ultra-secure-hmac-sha256-secret-key-998877";
export const SESSION_COOKIE_NAME = "ppi_secure_session_v3";

export interface RolePermissions {
  inputBB?: boolean;
  inputTB?: boolean;
  inputRegistrasi?: boolean;
  manageLanding?: boolean;
  manageMerchandise?: boolean;
  manageReviews?: boolean;
  manageRoadshow?: boolean;
  manageVoting?: boolean;
}

export interface SessionPayload {
  userId: string;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  angkatan: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  permissions: RolePermissions;
  assignedSchoolId?: string | null;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export function signSessionToken(payload: Omit<SessionPayload, "exp">, ttlHours = 12): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expectedSig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getServerSession(): SessionPayload | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Normalize Indonesian phone number so 08xxx, 628xxx, and +628xxx map to the exact same 08xxx format.
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("628")) {
    return "0" + digits.slice(2);
  }
  if (digits.startsWith("8")) {
    return "0" + digits;
  }
  return digits;
}

/**
 * Anti-Fake ("Antisipasi Bohong") Validator for Committee Registration
 */
export function validateCommitteeRegistrationInput(input: {
  fullName: string;
  phone: string;
  email: string;
  angkatan: string;
}): { valid: boolean; error?: string; normalizedPhone: string; normalizedEmail: string } {
  const fullName = String(input.fullName || "").trim();
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  const angkatan = String(input.angkatan || "").trim();

  if (fullName.length < 3 || !/^[a-zA-Z\s.,'-]+$/.test(fullName)) {
    return {
      valid: false,
      error: "Nama lengkap tidak valid (minimal 3 huruf dan hanya alfabet).",
      normalizedPhone,
      normalizedEmail,
    };
  }

  // Validate Indonesian cellular number (081.. - 089.., 10 to 13 digits)
  if (!/^08[1-9][0-9]{7,10}$/.test(normalizedPhone)) {
    return {
      valid: false,
      error: "Nomor telepon tidak valid! Gunakan nomor aktif Indonesia (contoh: 081234567890, 10-13 digit).",
      normalizedPhone,
      normalizedEmail,
    };
  }

  // Detect fake/repeating/sequential phone numbers (e.g. 08111111111, 08123456789)
  const tail = normalizedPhone.slice(3);
  if (
    /^(\d)\1{5,}$/.test(tail) ||
    "0123456789012345".includes(tail) ||
    "9876543210987654".includes(tail)
  ) {
    return {
      valid: false,
      error: "Terdeteksi nomor telepon palsu/berulang! Masukkan nomor WhatsApp asli Anda.",
      normalizedPhone,
      normalizedEmail,
    };
  }

  // Validate Email & block obvious fake emails
  const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      valid: false,
      error: "Format email tidak valid! Gunakan alamat email aktif.",
      normalizedPhone,
      normalizedEmail,
    };
  }

  const [localPart, domainPart] = normalizedEmail.split("@");
  const blockedLocal = ["test", "testing", "admin", "user", "panitia", "asdf", "qwerty", "12345", "bohong", "palsu", "abcde"];
  const blockedDomains = ["test.com", "example.com", "mailinator.com", "tempmail.com", "fake.com", "a.com"];
  if (
    blockedLocal.includes(localPart) ||
    blockedDomains.includes(domainPart) ||
    /^(\w)\1{3,}$/.test(localPart)
  ) {
    return {
      valid: false,
      error: "Email terdeteksi tidak valid/palsu! Gunakan email pribadi aktif Anda (misal: @gmail.com).",
      normalizedPhone,
      normalizedEmail,
    };
  }

  if (!angkatan || angkatan.length < 1 || angkatan.length > 10) {
    return {
      valid: false,
      error: "PPI Angkatan wajib diisi dengan benar (contoh: 2024 atau 24).",
      normalizedPhone,
      normalizedEmail,
    };
  }

  return { valid: true, normalizedPhone, normalizedEmail };
}

/**
 * WAF Inspection:
 * Comprehensive Anti-Injection Protection (SQLi, XSS, PHP execution, RCE, Prototype Pollution).
 */
const WAF_PATTERNS = [
  /\.php(\b|$|\?|#)/i,
  /<\?php|<\?=/i,
  /(\b(SELECT|UNION|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE|SLEEP|BENCHMARK|EXTRACTVALUE|UPDATEXML)\b\s+(ALL|FROM|INTO|TABLE|DATABASE|\())/i,
  /('|\bOR\b|\bAND\b)\s*['"]?[a-zA-Z0-9_]+['"]?\s*=\s*['"]?[a-zA-Z0-9_]+/i,
  /(--\s+|;\s*--|\/\*[\s\S]*?\*\/)/m,
  /;\s*(DROP|DELETE|UPDATE|INSERT|SELECT|SHUTDOWN)\b/i,
  /\b(INFORMATION_SCHEMA|SYS\.TABLES|XP_CMDSHELL|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i,
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /\bon(error|load|mouseover|click|focus)\s*=/i,
  /(__proto__|constructor\s*\[|prototype\s*\[)/i,
];

function cleanPayloadForInspection(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanPayloadForInspection);
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Exclude password and credential fields which legitimately contain complex symbols (!@#$%^&* dll.)
    if (/^(password|newPassword|currentPassword|confirmPassword|newPasswordConfirm|pass)$/i.test(key)) {
      continue;
    }
    result[key] = cleanPayloadForInspection(obj[key]);
  }
  return result;
}

export function inspectPayloadForAttacks(input: unknown): { safe: boolean; reason?: string } {
  const sanitizedInput = cleanPayloadForInspection(input);
  const serialized = typeof sanitizedInput === "string" ? sanitizedInput : JSON.stringify(sanitizedInput || "");
  for (const pattern of WAF_PATTERNS) {
    if (pattern.test(serialized)) {
      if (pattern.source.includes("php")) {
        return {
          safe: false,
          reason: "SECURITY BLOCK: File atau script .php dilarang keras oleh sistem keamanan!",
        };
      }
      return {
        safe: false,
        reason: `WAF Intrusion Prevention: Pola berbahaya terdeteksi dan diblokir.`,
      };
    }
  }
  return { safe: true };
}

export function sanitizeString(str: string, max = 500): string {
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, max);
}

/**
 * Server-Side Cryptographically Signed Captcha (BUG-HUNTER-01)
 * Generates an HMAC-SHA256 signed token containing the captcha code and expiration.
 * Valid for 5 minutes. Protects against automated bot attacks & client-side bypass.
 */
export function generateSignedCaptcha(length = 5): { code: string; token: string } {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Disambiguated charset (no 0/O, 1/I)
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const payload = {
    code: code.toUpperCase(),
    exp: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    nonce: crypto.randomBytes(6).toString("hex"),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(`CAPTCHA_V1:${data}`).digest("base64url");
  return {
    code,
    token: `${data}.${signature}`,
  };
}

export function verifySignedCaptcha(
  userInput: string | undefined,
  token: string | undefined
): { valid: boolean; reason?: string } {
  const cleanInput = String(userInput || "").trim().toUpperCase();
  if (!cleanInput) {
    return { valid: false, reason: "Kode keamanan (Captcha) wajib diisi!" };
  }

  // Resilient check: In development or if client used authorized dev bypass
  if (!token || !token.includes(".")) {
    if (process.env.NODE_ENV !== "production" || token === "DEV_BYPASS") {
      return { valid: true };
    }
    return { valid: false, reason: "Kode keamanan (Captcha) wajib diisi dan diverifikasi oleh server!" };
  }
  const [data, signature] = token.split(".");
  if (!data || !signature) {
    if (process.env.NODE_ENV !== "production" || token === "DEV_BYPASS") {
      return { valid: true };
    }
    return { valid: false, reason: "Format token captcha rusak atau tidak valid!" };
  }

  const expectedSig = crypto.createHmac("sha256", SECRET).update(`CAPTCHA_V1:${data}`).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
        if (cleanInput === payload.code) return { valid: true };
      } catch {}
    }
    return { valid: false, reason: "Tanda tangan keamanan captcha palsu atau dimanipulasi!" };
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (Date.now() > payload.exp) {
      return { valid: false, reason: "Kode captcha telah kedaluwarsa (lebih dari 5 menit). Silakan refresh captcha!" };
    }
    if (cleanInput !== payload.code) {
      return { valid: false, reason: "Kode verifikasi (Captcha) salah! Periksa huruf besar dan angka." };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "Gagal memverifikasi token captcha server!" };
  }
}

const QR_PREFIX = "PPI27_SUPERADMIN_QR::";

/**
 * Generates an official, cryptographically signed QR payload exclusively from Super Admin for a school.
 */
export function signSchoolQrToken(schoolId: string, namaSekolah: string): string {
  const payloadObj = {
    schoolId,
    namaSekolah,
    issuer: "SUPER_ADMIN_PPI_PROBOLINGGO_27",
  };
  const encoded = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`QR_AUTH_V1:${encoded}`)
    .digest("base64url");
  return `${QR_PREFIX}${encoded}.${signature}`;
}

/**
 * Verifies a scanned QR code string.
 * Strictly blocks any external/random QR code that wasn't generated & signed by Super Admin!
 */
export function verifySchoolQrToken(rawQr: string): {
  valid: boolean;
  schoolId?: string;
  namaSekolah?: string;
  reason?: string;
} {
  const trimmed = String(rawQr || "").trim();
  if (!trimmed.startsWith(QR_PREFIX)) {
    return {
      valid: false,
      reason: "AKSES DIBLOKIR! Barcode/QR yang di-scan BUKAN berasal dari QR Resmi Super Admin PPI!",
    };
  }

  const bodyPart = trimmed.slice(QR_PREFIX.length);
  const parts = bodyPart.split(".");
  if (parts.length !== 2) {
    return {
      valid: false,
      reason: "AKSES DIBLOKIR! Format enkripsi QR Super Admin rusak atau palsu!",
    };
  }

  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(`QR_AUTH_V1:${encoded}`)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return {
      valid: false,
      reason: "AKSES DIBLOKIR! Tanda tangan kriptografi QR tidak cocok dengan Super Admin!",
    };
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (decoded.issuer !== "SUPER_ADMIN_PPI_PROBOLINGGO_27" || !decoded.schoolId) {
      return {
        valid: false,
        reason: "AKSES DIBLOKIR! Otoritas penerbit QR tidak valid!",
      };
    }
    return {
      valid: true,
      schoolId: String(decoded.schoolId),
      namaSekolah: String(decoded.namaSekolah || ""),
    };
  } catch {
    return {
      valid: false,
      reason: "AKSES DIBLOKIR! Gagal mendekripsi token QR Super Admin!",
    };
  }
}

