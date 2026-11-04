"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function FormPenilaianPage() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState<"umum" | "ppi">("umum");
  const [angkatan, setAngkatan] = useState("");
  const [rating, setRating] = useState(5);
  const [pesan, setPesan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = nama.trim();
    const cleanPesan = pesan.trim();

    if (!cleanNama || !cleanPesan) {
      alert("Harap lengkapi Nama dan Pesan.");
      return;
    }

    if (cleanNama.length > 50 || cleanPesan.length > 50) {
      alert("Nama dan isi penilaian maksimal 50 huruf!");
      return;
    }

    if (/\.php|<\?php/i.test(cleanNama) || /\.php|<\?php/i.test(cleanPesan)) {
      alert("Akses Ditolak: Dilarang memasukkan file atau script .php!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "review",
          nama: cleanNama.slice(0, 50),
          kategori,
          angkatan: kategori === "ppi" ? angkatan.slice(0, 10) || "-" : "-",
          rating,
          pesan: cleanPesan.slice(0, 50),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal mengirim penilaian.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        window.location.href = "/#penilaian-preview";
      }, 1200);
    } catch {
      alert("Terjadi kesalahan jaringan.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Penilaian Terkirim</h2>
        <p className="text-sm text-zinc-400 mt-1">Terima kasih atas partisipasi Anda.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-white tracking-tight">Form Penilaian PPI</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Berikan masukan singkat Anda (Maksimal 50 huruf).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-zinc-200">
                Nama Lengkap
              </label>
              <span className="text-[11px] font-mono text-zinc-500">
                {nama.length}/50
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={50}
              value={nama}
              onChange={(e) => setNama(e.target.value.replace(/\.php/gi, "").slice(0, 50))}
              placeholder="Masukkan nama Anda (maks 50 huruf)"
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-red-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-200 mb-1.5">
              Kategori Responden
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value as "umum" | "ppi")}
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-red-500 focus:outline-none transition"
            >
              <option value="umum">Masyarakat Umum</option>
              <option value="ppi">Purna Paskibraka (PPI)</option>
            </select>
          </div>

          {kategori === "ppi" && (
            <div>
              <label className="block text-sm font-semibold text-zinc-200 mb-1.5">
                Tahun Angkatan
              </label>
              <input
                type="number"
                required
                value={angkatan}
                onChange={(e) => setAngkatan(e.target.value.slice(0, 4))}
                placeholder="Contoh: 2024"
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-red-500 focus:outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-zinc-200 mb-1.5">
              Rating Layanan
            </label>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-3xl transition transform hover:scale-110 focus:outline-none"
                >
                  <span className={star <= rating ? "text-amber-400" : "text-zinc-700"}>
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-zinc-200">
                Pesan & Saran
              </label>
              <span className="text-[11px] font-mono text-zinc-500">
                {pesan.length}/50
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={50}
              value={pesan}
              onChange={(e) => setPesan(e.target.value.replace(/\.php/gi, "").slice(0, 50))}
              placeholder="Tuliskan ulasan singkat (maksimal 50 huruf)..."
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-red-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition"
          >
            {submitting ? "Mengirim..." : "Kirim Penilaian"}
          </button>

          <Link
            href="/"
            className="block text-center text-xs text-zinc-400 hover:text-white pt-1 transition"
          >
            Kembali ke Beranda
          </Link>
        </form>
      </div>
    </div>
  );
}
