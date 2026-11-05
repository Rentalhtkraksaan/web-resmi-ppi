"use client";

import { useEffect, useRef } from "react";

/**
 * Menjalankan `fn` berulang (realtime polling) selama tab terlihat.
 * - Tidak pernah menumpuk request (menunggu request sebelumnya selesai)
 * - Berhenti saat tab disembunyikan, langsung refresh saat tab kembali aktif / fokus
 */
export function useLive(fn: () => void | Promise<void>, intervalMs = 1000, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    let cancelled = false;

    const tick = async () => {
      if (busy || cancelled || document.visibilityState === "hidden") return;
      busy = true;
      try {
        await fnRef.current();
      } catch {
        // abaikan, coba lagi di tick berikutnya
      } finally {
        busy = false;
      }
    };

    const id = setInterval(tick, intervalMs);
    const onWake = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [intervalMs, enabled]);
}

