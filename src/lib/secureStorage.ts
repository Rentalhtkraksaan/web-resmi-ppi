import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  UserCredential,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  set,
  push,
  serverTimestamp,
} from "firebase/database";
import { UMUM_FIREBASE_CONFIG } from "./firebase";

// Inisialisasi Firebase App (Singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(UMUM_FIREBASE_CONFIG);
export const auth = getAuth(app);
export const database = getDatabase(app);

// Konfigurasi Cloudinary (Unsigned Preset)
export const CLOUDINARY_CONFIG = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "ppi-probolinggo",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ppi_unsigned_preset",
};

// ============================================================================
// ALUR 1: DATA AKUN USER (KEAMANAN BERLAPIS 3 TINGKAT)
// ============================================================================

export interface RegisterUserData {
  fullName: string;
  phoneWhatsApp: string;
  email: string;
  password: string;
}

export interface UserProfileData {
  uid: string;
  fullName: string;
  phoneWhatsApp: string;
  email: string;
  createdAt: number;
}

/**
 * Mendaftarkan akun user baru dengan 3 tingkat keamanan:
 * 1. Password hanya diproses via Firebase Auth (otomatis di-hash & tidak pernah masuk RTDB).
 * 2. Data profil disimpan terisolasi di path /users/${uid}.
 * 3. Validasi input ketat (panjang karakter, format WhatsApp Indonesia, email).
 */
export async function registerUserWithProfile(
  data: RegisterUserData
): Promise<{ user: UserCredential["user"]; profile: UserProfileData }> {
  const { fullName, phoneWhatsApp, email, password } = data;

  // Validasi Input Frontend (Tingkat 3 - Client Pre-validation)
  if (!fullName || fullName.trim().length < 3) {
    throw new Error("Nama lengkap minimal 3 karakter.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format alamat email tidak valid.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  // Normalisasi & Validasi Nomor WhatsApp (format: 08xx atau 628xx)
  const cleanPhone = phoneWhatsApp.replace(/[^0-9]/g, "");
  if (!/^(08|628)[0-9]{8,12}$/.test(cleanPhone)) {
    throw new Error(
      "Format nomor WhatsApp tidak valid. Gunakan awalan 08 atau 628 (contoh: 085176871609)."
    );
  }

  // Tingkat 1: Firebase Authentication (Password di-hash bcrypt/scrypt otomatis oleh Firebase)
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  const user = userCredential.user;

  // Tingkat 2: Isolasi Path Database /users/${user.uid}
  // CATATAN: Field "password" SAMA SEKALI TIDAK BOLEH disertakan di sini!
  const userRef = ref(database, `users/${user.uid}`);
  const profilePayload: UserProfileData = {
    uid: user.uid,
    fullName: fullName.trim(),
    phoneWhatsApp: cleanPhone,
    email: user.email || email.trim().toLowerCase(),
    createdAt: Date.now(),
  };

  // Simpan data profil ke RTDB
  await set(userRef, profilePayload);

  return { user, profile: profilePayload };
}

// ============================================================================
// ALUR 2: FOTO PRODUK / FOTO KEGIATAN (DECOUPLED STORAGE)
// ============================================================================

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  bytes: number;
}

export interface ActivityMetadata {
  title: string;
  description?: string;
  date?: string;
  location?: string;
  category?: string;
}

export interface ProductMetadata {
  title: string;
  price?: number;
  description?: string;
  category?: string;
}

/**
 * Langkah 1: Upload file fisik foto ke Cloudinary (Unsigned Upload)
 * File fisik TIDAK DISIMPAN di Firebase untuk menghemat kuota & optimalisasi CDN.
 */
export async function uploadImageToCloudinary(
  file: File,
  customPreset?: string,
  customCloudName?: string
): Promise<CloudinaryUploadResponse> {
  const cloudName = customCloudName || CLOUDINARY_CONFIG.cloudName;
  const uploadPreset = customPreset || CLOUDINARY_CONFIG.uploadPreset;

  // Validasi tipe file
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (JPEG, PNG, WebP).");
  }

  // Batas ukuran 5MB
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || "Gagal mengunggah foto ke Cloudinary."
    );
  }

  const result = await response.json();
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Langkah 2: Simpan metadata kegiatan / produk ke Firebase RTDB
 * Menyimpan detail teks + secure_url gambar menggunakan push().
 */
export async function saveActivityMetadata(
  metadata: ActivityMetadata,
  imageUrl: string
): Promise<{ id: string; url: string }> {
  if (!imageUrl || !imageUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error("URL gambar tidak valid atau bukan berasal dari Cloudinary.");
  }

  const activitiesRef = ref(database, "activities");
  const newActivityRef = push(activitiesRef);

  const payload = {
    title: metadata.title.trim(),
    description: metadata.description?.trim() || "",
    date: metadata.date || new Date().toISOString().split("T")[0],
    location: metadata.location?.trim() || "Kabupaten Probolinggo",
    category: metadata.category || "DOKUMENTASI",
    imageUrl: imageUrl,
    createdAt: Date.now(),
    authorUid: auth.currentUser ? auth.currentUser.uid : null,
  };

  await set(newActivityRef, payload);

  return {
    id: newActivityRef.key as string,
    url: imageUrl,
  };
}

export async function saveProductMetadata(
  metadata: ProductMetadata,
  imageUrl: string
): Promise<{ id: string; url: string }> {
  if (!imageUrl || !imageUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error("URL gambar tidak valid atau bukan berasal dari Cloudinary.");
  }

  const productsRef = ref(database, "products");
  const newProductRef = push(productsRef);

  const payload = {
    title: metadata.title.trim(),
    price: metadata.price || 0,
    description: metadata.description?.trim() || "",
    category: metadata.category || "MERCHANDISE",
    imageUrl: imageUrl,
    createdAt: Date.now(),
    authorUid: auth.currentUser ? auth.currentUser.uid : null,
  };

  await set(newProductRef, payload);

  return {
    id: newProductRef.key as string,
    url: imageUrl,
  };
}

