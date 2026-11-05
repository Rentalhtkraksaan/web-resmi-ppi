export const ROADSHOW_RTDB_URL = "https://paskab-c3eb4-default-rtdb.firebaseio.com";
export const UMUM_RTDB_URL = "https://paskab-c3eb4-default-rtdb.firebaseio.com";

export const ROADSHOW_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCtQh5SpZCk2TDUk9iMOjQX5uc6gRIJyp8",
  authDomain: "paskab-c3eb4.firebaseapp.com",
  databaseURL: "https://paskab-c3eb4-default-rtdb.firebaseio.com",
  projectId: "paskab-c3eb4",
  storageBucket: "paskab-c3eb4.firebasestorage.app",
  messagingSenderId: "630872087747",
  appId: "1:630872087747:web:dbe8eee722f2d0f6759676",
  measurementId: "G-SM5LN74FK4",
};

export const UMUM_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCtQh5SpZCk2TDUk9iMOjQX5uc6gRIJyp8",
  authDomain: "paskab-c3eb4.firebaseapp.com",
  databaseURL: "https://paskab-c3eb4-default-rtdb.firebaseio.com",
  projectId: "paskab-c3eb4",
  storageBucket: "paskab-c3eb4.firebasestorage.app",
  messagingSenderId: "630872087747",
  appId: "1:630872087747:web:dbe8eee722f2d0f6759676",
  measurementId: "G-SM5LN74FK4",
};

/**
 * Server-side Firebase RTDB Bridge (syncs Prisma <-> Firebase Realtime Database)
 */
export async function firebaseGet<T = any>(baseUrl: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}/${path}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function firebasePut(baseUrl: string, path: string, data: unknown): Promise<void> {
  try {
    await fetch(`${baseUrl}/${path}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // Non-blocking fallback if offline
  }
}

export async function firebasePush(baseUrl: string, path: string, data: unknown): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/${path}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string };
    return json?.name || null;
  } catch {
    return null;
  }
}

export async function firebaseDelete(baseUrl: string, path: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/${path}.json`, {
      method: "DELETE",
    });
  } catch {
    // Non-blocking fallback
  }
}

