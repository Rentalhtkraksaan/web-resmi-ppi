"use client";

import React from "react";
import Link from "next/link";

export default function BiodataDeveloperPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-6 border-b border-zinc-800">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition text-center"
          >
            ← Kembali ke Beranda
          </Link>

          <a
            href="https://cv-aditya.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition shadow-lg text-center truncate"
          >
            Kunjungi Website Resmi: cv-aditya.vercel.app ↗
          </a>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-8 items-start">
          {/* Left Column: Photo & QR Website */}
          <div className="md:col-span-4 flex flex-col items-center text-center space-y-5">
            <img
              src="/IMG_20251214_222804.jpg"
              alt="Achmad Furqon Aditya Putra"
              className="w-40 h-40 rounded-full object-cover border-4 border-amber-500/40 shadow-xl"
            />

            <div>
              <h1 className="text-xl font-bold text-white">
                Achmad Furqon Aditya Putra
              </h1>
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mt-1">
                Developer Sistem • KWH PPI
              </p>
            </div>

            {/* Official Website & QR Card */}
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <img
                src="/bc.jpg"
                alt="QR Code cv-aditya.vercel.app"
                className="w-36 h-36 object-cover rounded-xl mx-auto border border-amber-500/40"
              />
              <div className="text-xs text-zinc-400">Scan atau klik untuk profil lengkap:</div>
              <a
                href="https://cv-aditya.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="block w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-400 font-mono font-bold text-xs transition"
              >
                cv-aditya.vercel.app
              </a>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="md:col-span-8 space-y-6">
            {/* Informasi Dasar & Kontak */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-l-2 border-amber-400 pl-2.5">
                Informasi Dasar & Kontak
              </h2>
              <div className="divide-y divide-zinc-900 text-sm">
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">Nama Lengkap</span>
                  <span className="font-semibold text-white text-right">Achmad Furqon Aditya Putra</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">NRA</span>
                  <span className="font-semibold text-white">2023.13.28.034</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">Angkatan PPI</span>
                  <span className="font-semibold text-white">2023</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">Jabatan Aktif</span>
                  <span className="font-semibold text-red-400">KWH</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">WhatsApp</span>
                  <a
                    href="https://wa.me/6285176871609"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-amber-400 hover:underline"
                  >
                    0851-7687-1609
                  </a>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">Instagram</span>
                  <a
                    href="https://instagram.com/_.adityaptra"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-amber-400 hover:underline"
                  >
                    @_.adityaptra
                  </a>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-zinc-400">Website Resmi</span>
                  <a
                    href="https://cv-aditya.vercel.app"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-sky-400 hover:underline break-all text-right"
                  >
                    https://cv-aditya.vercel.app
                  </a>
                </div>
              </div>
            </div>

            {/* Prestasi Terpilih */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-l-2 border-amber-400 pl-2.5">
                  Prestasi Terpilih — Komandan Upacara HARDIKNAS
                </h2>
                <a
                  href="https://www.kabarpas.com/tari-glipang-sewu-semarakkan-peringatan-hardiknas-di-probolinggo/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] uppercase"
                >
                  Data Asli
                </a>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dipercaya menjadi Komandan Upacara pada Peringatan Hari Pendidikan Nasional di Alun-Alun Kraksaan Tahun 2024.
              </p>
              <video
                controls
                playsInline
                preload="metadata"
                className="w-full max-w-[240px] rounded-xl border border-zinc-800"
              >
                <source src="/video.mp4" type="video/mp4" />
              </video>
            </div>

            {/* Organisasi & Proyek */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Organisasi & Pengalaman
                </h3>
                <ul className="text-xs text-zinc-300 space-y-1.5">
                  <li>• Vice President CLUB WIRAUSAHA UNUJA</li>
                  <li>• Head of Department BEM Fakultas Teknik</li>
                  <li>• Speaker PMB UNUJA</li>
                  <li>• KWH PPI Kab. Probolinggo</li>
                  <li>• Ketua Angkatan Paskibraka (2023)</li>
                  <li>• Cadreization HIMATIKA & Media Creative GYN</li>
                </ul>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Proyek Digital
                </h3>
                <ul className="text-xs text-zinc-300 space-y-1.5">
                  <li>• Website Kasir Dinamis</li>
                  <li>• Website PPI Roadshow</li>
                  <li>• Website Ormawa CLUB WIRAUSAHA UNUJA</li>
                  <li>• Website Rental HT Kraksaan</li>
                </ul>
                <div className="pt-2">
                  <a
                    href="https://cv-aditya.vercel.app"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-semibold text-amber-400 hover:underline"
                  >
                    Lihat Portofolio Lengkap di cv-aditya.vercel.app →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
