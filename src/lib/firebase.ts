/**
 * Server-side Firebase RTDB Bridge: DINONAKTIFKAN.
 * Seluruh data kini hanya disimpan di database TiDB. Fungsi di bawah dibiarkan sebagai
 * no-op agar kode lama tetap berjalan tanpa menghubungi Firebase sama sekali.
 */
export const ROADSHOW_RTDB_URL = "";
export const UMUM_RTDB_URL = "";

export async function firebaseGet<T = any>(_baseUrl: string, _path: string): Promise<T | null> {
  return null;
}

export async function firebasePut(_baseUrl: string, _path: string, _data: unknown): Promise<void> {}

export async function firebasePush(_baseUrl: string, _path: string, _data: unknown): Promise<string | null> {
  return null;
}

export async function firebaseDelete(_baseUrl: string, _path: string): Promise<void> {}
