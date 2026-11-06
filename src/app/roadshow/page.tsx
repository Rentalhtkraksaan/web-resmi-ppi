"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/useLive";
import Link from "next/link";
import { toRoadshowSlug } from "@/lib/slug";
import { resolveAutoPostStatus } from "@/lib/roadshowSchedule";
import RoadshowShareWidget from "@/components/RoadshowShareWidget";

interface PassedCandidate {
  id: string;
  kodePeserta: string;
  nama: string;
  jenisKelamin: string;
  schoolId: string;
  namaSekolah?: string;
  hasilLulus: boolean;
  statusTayang: boolean;
  keterangan: string;
}

interface SchoolWithPassed {
  id: string;
  namaSekolah: string;
  lokasi: string;
  tanggal: string;
  statusPenilaian: string;
  passedCount: number;
  candidates: PassedCandidate[];
}

interface RoadshowPost {
  id: string;
  title: string;
  category: string;
  status: "SUDAH_DIKUNJUNGI" | "SEDANG_BERLANGSUNG" | "AKAN_DIKUNJUNGI";
  schoolId?: string;
  schoolName: string;
  location: string;
  date: string;
  time?: string;
  imageUrl: string;
  imageUrls?: string;
  imageUrlsList?: string[];
  summary: string;
  content: string;
  sortOrder: number;
  isPublished: boolean;
  author: string;
  createdAt: string;
}

export default function PublicRoadshowPage() {
  const [schools, setSchools] = useState<SchoolWithPassed[]>([]);
  const [posts, setPosts] = useState<RoadshowPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Main View Tab: "POSTS" (Berita/Informasi) or "CANDIDATES" (Hasil Seleksi Lolos)
  const [activeMainTab, setActiveMainTab] = useState<"POSTS" | "CANDIDATES">("POSTS");

  // Post Filter: "ALL" | "SEDANG_BERLANGSUNG" | "AKAN_DIKUNJUNGI" | "SUDAH_DIKUNJUNGI"
  const [postFilter, setPostFilter] = useState<"ALL" | "SEDANG_BERLANGSUNG" | "AKAN_DIKUNJUNGI" | "SUDAH_DIKUNJUNGI">("ALL");
  const [searchPostQuery, setSearchPostQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<RoadshowPost | null>(null);
  const [activeModalPhotoIndex, setActiveModalPhotoIndex] = useState(0);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const handleCopyPostLink = async (e: React.MouseEvent, post: RoadshowPost) => {
    e.stopPropagation();
    const slug = toRoadshowSlug(post.schoolName, post.location) || post.id;
    const shareUrl = `https://www.ppikabupatenprobolinggo.id/roadshow/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedPostId(post.id);
      setTimeout(() => setCopiedPostId(null), 2500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedPostId(post.id);
      setTimeout(() => setCopiedPostId(null), 2500);
    }
  };

  // Candidate Filter State
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("ALL");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Cowok" | "Cewek">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Dropdown State for Candidate School Selection
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const res = await fetch("/api/roadshow?mode=public", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const rawPosts: RoadshowPost[] = data.posts || [];
        const resolvedPosts = rawPosts.map((p) => ({
          ...p,
          status: resolveAutoPostStatus(p),
        }));
        setSchools(data.schools || []);
        setPosts(resolvedPosts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Realtime: data yang dihapus / diubah di database langsung ikut berubah (~1 detik)
  useLive(loadData, 1000);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered Posts
  const filteredPosts = posts.filter((p) => {
    const matchStatus = postFilter === "ALL" || p.status === postFilter;
    const q = searchPostQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.schoolName.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const countSedang = posts.filter((p) => p.status === "SEDANG_BERLANGSUNG").length;
  const countAkan = posts.filter((p) => p.status === "AKAN_DIKUNJUNGI").length;
  const countSudah = posts.filter((p) => p.status === "SUDAH_DIKUNJUNGI").length;

  // Candidates Logic
  const selectedSchool =
    selectedSchoolId === "ALL"
      ? null
      : schools.find((s) => s.id === selectedSchoolId) || null;

  const filteredDropdownSchools = schools.filter((s) =>
    s.namaSekolah.toLowerCase().includes(schoolSearch.toLowerCase().trim())
  );

  const rawCandidates: PassedCandidate[] =
    selectedSchoolId === "ALL"
      ? schools.flatMap((s) =>
          s.candidates.map((c) => ({
            ...c,
            namaSekolah: s.namaSekolah,
          }))
        )
      : selectedSchool
      ? selectedSchool.candidates.map((c) => ({
          ...c,
          namaSekolah: selectedSchool.namaSekolah,
        }))
      : [];

  const totalPassedAllSchools = schools.reduce((acc, s) => acc + (s.passedCount || 0), 0);

  const filteredCandidates = rawCandidates.filter((c) => {
    const matchGender = genderFilter === "ALL" || c.jenisKelamin === genderFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      c.nama.toLowerCase().includes(q) ||
      c.kodePeserta.toLowerCase().includes(q) ||
      (c.namaSekolah || "").toLowerCase().includes(q);
    return matchGender && matchSearch;
  });

  const handleShareWhatsApp = (c: PassedCandidate) => {
    const schoolName = c.namaSekolah || selectedSchool?.namaSekolah || "SMA/SMK Mitra Roadshow";
    const text =
      `*ALHAMDULILLAH LOLOS SELEKSI ROADSHOW PPI KABUPATEN PROBOLINGGO*\n\n` +
      `Saya atas nama: *${c.nama.toUpperCase()}*\n` +
      `Asal Sekolah: *${schoolName}*\n` +
      `Kode Peserta: *${c.kodePeserta}*\n\n` +
      `Dinyatakan *LOLOS SELEKSI TAHAP AWAL ROADSHOW PPI* dan berhak melangkah ke seleksi Calon Paskibraka Kabupaten Probolinggo!\n\n` +
      `Cek hasil verifikasi resmi di:\n` +
      `https://ppikabupatenprobolinggo.id/roadshow\n\n` +
      `#PaskibrakaKabupatenProbolinggo #RoadshowPPI #GenerasiEmas`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const selectedLabel =
    selectedSchoolId === "ALL"
      ? "Semua Sekolah"
      : selectedSchool
      ? selectedSchool.namaSekolah
      : "-- Pilih Sekolah --";

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hasil Seleksi Roadshow Paskibraka Kabupaten Probolinggo",
    description:
      "Daftar nama siswa lolos seleksi fisik awal Roadshow Purna Paskibraka Indonesia Kabupaten Probolinggo.",
    itemListElement: filteredCandidates.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Person",
        name: c.nama,
        identifier: c.kodePeserta,
        gender: c.jenisKelamin,
        memberOf: {
          "@type": "EducationalOrganization",
          name: c.namaSekolah || "Sekolah Kabupaten Probolinggo",
        },
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 flex flex-col selection:bg-red-600 selection:text-white">
      {/* Schema.org JSON-LD for Google Search Engine indexing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR (BERSIH, RAPI, RESPONSIVE, TANPA DOUBLE DROPDOWN)       */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3 w-full">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition shrink-0">
              PPI
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xs sm:text-sm text-white tracking-tight uppercase truncate">
                ROADSHOW KAB. PROBOLINGGO
              </span>
              <span className="block text-[10px] text-zinc-400 font-medium truncate">
                Purna Paskibraka Indonesia
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition whitespace-nowrap"
            >
              Beranda
            </Link>

            <Link
              href="/login"
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition shadow-md shadow-red-600/30 flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <span>Login Petugas</span>
              <span className="hidden sm:inline">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. HEADER BANNER (DISKOMINFO PROBOLINGGO STYLE DENGAN BREADCRUMB)      */}
      {/* ===================================================================== */}
      <section className="bg-gradient-to-r from-[#1e3a1f] via-[#2d5028] to-[#1e3a1f] border-b border-emerald-900/60 px-5 sm:px-8 py-7 sm:py-9 shadow-inner">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Informasi &amp; Kabar Roadshow
            </h1>
            <div className="flex items-center gap-2 text-xs text-emerald-200/80 mt-1 font-medium">
              <Link href="/" className="hover:underline">Beranda</Link>
              <span>&gt;</span>
              <span className="text-white font-semibold">
                {activeMainTab === "POSTS" ? "Informasi Kunjungan Sekolah" : "Hasil Seleksi Peserta Lolos"}
              </span>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto">
            <div className="text-right">
              <span className="block text-[10px] text-emerald-200 uppercase font-semibold">
                Total Sekolah Mitra
              </span>
              <span className="text-sm font-black text-white">
                {schools.length} Sekolah Terdaftar
              </span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. MAIN NAVIGATION TABS (BERITA & AGENDA vs DATA PESERTA LOLOS)        */}
      {/* ===================================================================== */}
      <div className="bg-zinc-950 border-b border-zinc-800/80 px-4 sm:px-8 sticky top-[53px] z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-2 py-2.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMainTab("POSTS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeMainTab === "POSTS"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            <span>Kabar &amp; Berita Kunjungan</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 font-mono">
              {posts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("CANDIDATES")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeMainTab === "CANDIDATES"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            <span>Daftar Siswa Lolos Seleksi</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 font-mono">
              {totalPassedAllSchools}
            </span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. CONTENT AREA: TAB 1 (BERITA ROADSHOW - DISKOMINFO STYLE GRID)       */}
      {/* ===================================================================== */}
      {activeMainTab === "POSTS" && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
          {/* Sub-Filter: Semua / Sedang Berlangsung / Akan Dikunjungi / Sudah Dikunjungi + Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPostFilter("ALL")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  postFilter === "ALL"
                    ? "bg-white text-black shadow-sm"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Semua ({posts.length})
              </button>

              <button
                type="button"
                onClick={() => setPostFilter("SEDANG_BERLANGSUNG")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  postFilter === "SEDANG_BERLANGSUNG"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/40"
                    : "bg-zinc-950 text-red-400 border border-red-900/60 hover:bg-red-950/30"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>Sedang Berlangsung</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 font-mono">
                  {countSedang}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPostFilter("AKAN_DIKUNJUNGI")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  postFilter === "AKAN_DIKUNJUNGI"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                    : "bg-zinc-950 text-sky-400 border border-sky-900/60 hover:bg-sky-950/30"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>Akan Dikunjungi</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 font-mono">
                  {countAkan}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPostFilter("SUDAH_DIKUNJUNGI")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  postFilter === "SUDAH_DIKUNJUNGI"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-zinc-950 text-emerald-400 border border-emerald-900/60 hover:bg-emerald-950/30"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Sudah Dikunjungi</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 font-mono">
                  {countSudah}
                </span>
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={searchPostQuery}
                onChange={(e) => setSearchPostQuery(e.target.value)}
                placeholder="Cari berita, sekolah, atau lokasi..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 font-medium"
              />
              {searchPostQuery && (
                <button
                  type="button"
                  onClick={() => setSearchPostQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Card Grid (Model 3 Kolom Persis Diskominfo Probolinggo di Gambar) */}
          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-sm">
              Memuat data berita &amp; agenda roadshow...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center space-y-2">
              <p className="text-base font-bold text-white">Tidak ada berita atau agenda yang sesuai</p>
              <p className="text-xs text-zinc-400">
                Cobalah ganti filter status kunjungan atau kata kunci pencarian Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => {
                const isSudah = post.status === "SUDAH_DIKUNJUNGI";
                const isSedang = post.status === "SEDANG_BERLANGSUNG";
                const displayTime = post.time || "08:00 - 12:00 WIB";

                return (
                  <article
                    key={post.id}
                    onClick={() => {
                      setActiveModalPhotoIndex(0);
                      setSelectedPost(post);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer border border-zinc-200 hover:-translate-y-1 text-slate-800"
                  >
                    <div>
                      {isSudah ? (
                        /* Foto Dokumentasi untuk Sekolah yang SUDAH Dikunjungi */
                        <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                          {post.imageUrl ? (
                            <img
                              src={post.imageUrl}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800 p-4 text-center">
                              <span className="text-xs font-semibold">Foto Dokumentasi Kunjungan</span>
                            </div>
                          )}

                          {/* Status Badge: Pojok Kanan Atas */}
                          <div className="absolute top-3 right-3">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md bg-emerald-600 text-white">
                              Sudah Dikunjungi
                            </span>
                          </div>

                          {/* Date & Time Badge: Menempel di Bagian Bawah Gambar */}
                          <div className="absolute bottom-0 left-0">
                            <span className="inline-block px-3.5 py-1.5 bg-[#4c7c38] text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
                              {post.date || "AGUSTUS 2026"} • {displayTime}
                            </span>
                          </div>
                        </div>
                      ) : isSedang ? (
                        /* Card Header untuk Sekolah yang SEDANG BERLANGSUNG (KEDIP MERAH PELAN) */
                        <div className="bg-gradient-to-br from-[#2a0808] via-[#3d0f0f] to-[#1f0505] border-b border-red-800/50 p-5 text-white relative overflow-hidden">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-600/50 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              Sedang Berlangsung
                            </span>
                            <span className="text-[11px] font-bold text-red-200 font-mono">
                              {post.date} • {displayTime}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider block">
                              Target Kunjungan Tim PPI
                            </span>
                            <h4 className="text-sm font-black text-white truncate">
                              {post.schoolName || "Sekolah Mitra"}
                            </h4>
                          </div>
                        </div>
                      ) : (
                        /* Card Header untuk Sekolah yang AKAN DIKUNJUNGI */
                        <div className="bg-gradient-to-br from-[#0c1a30] via-[#112240] to-[#0a1426] border-b border-sky-800/40 p-5 text-white relative overflow-hidden">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 border border-sky-400/40 text-sky-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                              Akan Dikunjungi
                            </span>
                            <span className="text-[11px] font-bold text-sky-300 font-mono">
                              {post.date || "Jadwal Menyusul"} • {displayTime}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Target Kunjungan Tim PPI
                            </span>
                            <h4 className="text-sm font-black text-white truncate">
                              {post.schoolName || "Sekolah Mitra"}
                            </h4>
                          </div>
                        </div>
                      )}

                      {/* Card Content */}
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                          <span className={
                            isSedang
                              ? "text-red-600 uppercase tracking-wide font-bold"
                              : isSudah
                              ? "text-[#4c7c38] uppercase tracking-wide font-bold"
                              : "text-sky-600 uppercase tracking-wide font-bold"
                          }>
                            {post.category || (isSedang ? "Sedang Berlangsung" : isSudah ? "Kunjungan Selesai" : "Agenda Kunjungan")}
                          </span>
                          <span className="truncate max-w-[140px] font-medium">{post.location}</span>
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-red-600 transition line-clamp-2">
                          {post.title}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {post.summary || post.content}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={(e) => handleCopyPostLink(e, post)}
                        title="Salin link berita ini"
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 active:scale-95 ${
                          copiedPostId === post.id
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                        }`}
                      >
                        <span>{copiedPostId === post.id ? "Link Disalin!" : "Bagikan Link"}</span>
                      </button>

                      <span className="text-red-600 font-bold group-hover:underline flex items-center gap-1">
                        {isSudah ? "Baca Selengkapnya" : isSedang ? "Pantau Kegiatan" : "Lihat Info Agenda"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ===================================================================== */}
      {/* 5. CONTENT AREA: TAB 2 (DATA KANDIDAT LOLOS SELEKSI)                   */}
      {/* ===================================================================== */}
      {activeMainTab === "CANDIDATES" && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
          {/* School Selection & Filter Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Custom Compact Scrollable Dropdown Pilih Sekolah */}
              <div className="sm:col-span-7 relative" ref={dropdownRef}>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Pilih Asal Sekolah
                </label>

                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className={`w-full px-4 py-2.5 rounded-xl bg-zinc-950 border text-left text-sm font-semibold text-white flex items-center justify-between transition ${
                    dropdownOpen
                      ? "border-red-500 ring-1 ring-red-500/30"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <span className="truncate">{selectedLabel}</span>
                  <span className="text-xs text-zinc-400 ml-2">
                    {dropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 z-50 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-zinc-800 bg-zinc-900/80">
                      <input
                        type="text"
                        value={schoolSearch}
                        onChange={(e) => setSchoolSearch(e.target.value)}
                        placeholder="Cari nama sekolah..."
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSchoolId("ALL");
                          setDropdownOpen(false);
                          setSchoolSearch("");
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition ${
                          selectedSchoolId === "ALL"
                            ? "bg-red-600 text-white font-bold"
                            : "text-zinc-200 hover:bg-zinc-900 font-semibold"
                        }`}
                      >
                        <span>Semua Sekolah</span>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            selectedSchoolId === "ALL"
                              ? "bg-black/30 text-white"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {totalPassedAllSchools} Lolos
                        </span>
                      </button>

                      {filteredDropdownSchools.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-zinc-500 text-center">
                          Sekolah tidak ditemukan.
                        </div>
                      ) : (
                        filteredDropdownSchools.map((s) => {
                          const isSelected = s.id === selectedSchoolId;
                          return (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => {
                                setSelectedSchoolId(s.id);
                                setDropdownOpen(false);
                                setSchoolSearch("");
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition ${
                                isSelected
                                  ? "bg-red-600 text-white font-bold"
                                  : "text-zinc-200 hover:bg-zinc-900"
                              }`}
                            >
                              <span className="truncate">{s.namaSekolah}</span>
                              {s.passedCount > 0 && (
                                <span
                                  className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                    isSelected
                                      ? "bg-black/30 text-white"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {s.passedCount} Lolos
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter Gender */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Filter Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenderFilter("ALL")}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      genderFilter === "ALL"
                        ? "bg-red-600 text-white border-red-600 font-bold"
                        : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter("Cowok")}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      genderFilter === "Cowok"
                        ? "bg-sky-600 text-white border-sky-500 font-bold"
                        : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    Cowok
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter("Cewek")}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      genderFilter === "Cewek"
                        ? "bg-pink-600 text-white border-pink-500 font-bold"
                        : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    Cewek
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                maxLength={100}
                value={searchQuery.slice(0, 100)}
                onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
                placeholder={
                  selectedSchoolId === "ALL"
                    ? "Cari nama kandidat, kode peserta, atau asal sekolah..."
                    : `Cari kandidat di ${selectedSchool?.namaSekolah || ""}...`
                }
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
              />
            </div>

            {/* Status Info */}
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>
                Sekolah: <strong className="text-white uppercase">{selectedLabel}</strong>
              </span>
              <span>
                Hasil: <strong className="text-emerald-400">{filteredCandidates.length} Kandidat Lolos</strong>
              </span>
            </div>
          </div>

          {/* Candidates List */}
          <div className="space-y-3 pb-8">
            {filteredCandidates.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center space-y-1">
                <p className="text-sm font-semibold text-zinc-300">
                  Tidak ada data kandidat lolos yang ditemukan.
                </p>
                <p className="text-xs text-zinc-500">
                  Pastikan filter sekolah atau kata kunci pencarian Anda sudah sesuai.
                </p>
              </div>
            ) : (
              filteredCandidates.map((c, index) => (
                <div
                  key={c.id}
                  className="bg-zinc-900 border border-zinc-800 border-l-4 border-l-emerald-500 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-mono">#{index + 1}</span>
                        <span className="text-base font-bold text-white">{c.nama}</span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            c.jenisKelamin === "Cowok"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-pink-500/15 text-pink-300"
                          }`}
                        >
                          {c.jenisKelamin}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Kode: <strong className="text-sky-400 font-mono">{c.kodePeserta}</strong> •{" "}
                        <span className="text-zinc-300">{c.namaSekolah}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition active:scale-95 shadow-sm"
                        title="Bagikan ke WhatsApp Story / Status"
                      >
                        <span>Bagikan ke Story WA</span>
                      </button>
                      <span className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-md">
                        LOLOS
                      </span>
                    </div>
                  </div>

                  {c.keterangan && (
                    <div className="bg-zinc-950 border-l-2 border-amber-500 px-3.5 py-2.5 rounded-lg text-xs text-zinc-300">
                      <span className="font-bold text-amber-400 block text-[10px] uppercase mb-0.5">
                        Catatan Panitia:
                      </span>
                      {c.keterangan}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL BACA DETAIL BERITA (PERSIS FORMAT PORTAL BERITA RESMI)       */}
      {/* ===================================================================== */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col my-auto border border-zinc-200">
            {/* Header: Photo Gallery (Up to 5 Photos) or Gradient Status Header */}
            {(() => {
              let modalPhotos: string[] = [];
              if (selectedPost.imageUrlsList && Array.isArray(selectedPost.imageUrlsList)) {
                modalPhotos = selectedPost.imageUrlsList.filter(Boolean).slice(0, 5);
              } else if (selectedPost.imageUrls) {
                try {
                  const parsed = JSON.parse(selectedPost.imageUrls);
                  if (Array.isArray(parsed) && parsed.length > 0) modalPhotos = parsed.filter(Boolean).slice(0, 5);
                } catch {}
              }
              if (modalPhotos.length === 0 && selectedPost.imageUrl) {
                modalPhotos = [selectedPost.imageUrl];
              }

              if (modalPhotos.length > 0) {
                return (
                  <div className="relative aspect-[16/9] bg-slate-900 shrink-0">
                    <img
                      src={modalPhotos[activeModalPhotoIndex] || modalPhotos[0]}
                      alt={selectedPost.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedPost(null)}
                      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center font-bold text-sm shadow-lg transition z-10"
                    >
                      ✕
                    </button>

                    {modalPhotos.length > 1 && (
                      <div className="absolute top-4 left-4 z-10">
                        <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold">
                          Foto {activeModalPhotoIndex + 1} / {modalPhotos.length}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2">
                      {modalPhotos.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                          {modalPhotos.map((img, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveModalPhotoIndex(i)}
                              className={`w-12 h-8 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                                activeModalPhotoIndex === i
                                  ? "border-emerald-400 scale-105"
                                  : "border-white/40 opacity-70 hover:opacity-100"
                              }`}
                            >
                              <img src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-white">
                        <span
                          className={`px-3 py-1 font-bold uppercase tracking-wider rounded-md text-[11px] ${
                            selectedPost.status === "SEDANG_BERLANGSUNG"
                              ? "bg-red-600 text-white"
                              : selectedPost.status === "SUDAH_DIKUNJUNGI"
                              ? "bg-emerald-600 text-white"
                              : "bg-sky-600 text-white"
                          }`}
                        >
                          {selectedPost.status === "SEDANG_BERLANGSUNG"
                            ? "Sedang Berlangsung"
                            : selectedPost.status === "SUDAH_DIKUNJUNGI"
                            ? "Sudah Dikunjungi"
                            : "Akan Dikunjungi"}
                        </span>
                        <span className="font-semibold text-zinc-200">
                          {selectedPost.date || "Agustus 2026"} • {selectedPost.time || "08:00 - 12:00 WIB"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (selectedPost.status === "SEDANG_BERLANGSUNG") {
                return (
                  <div className="bg-gradient-to-r from-[#200508] via-[#33090e] to-[#1a0407] p-6 text-white border-b border-red-800/50 relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPost(null)}
                      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center font-bold text-sm shadow-lg transition"
                    >
                      ✕
                    </button>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/25 border border-red-500/50 text-red-200 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 duration-1000" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      <span className="tracking-widest">Sedang Berlangsung Hari Ini</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {selectedPost.title}
                    </h3>
                    <p className="text-xs text-red-200 mt-1">
                      Tanggal: <strong>{selectedPost.date || "Hari Ini"}</strong> • Jam: <strong>{selectedPost.time || "08:00 - 12:00 WIB"}</strong> • Lokasi: <strong>{selectedPost.location}</strong>
                    </p>
                  </div>
                );
              }

              return (
                <div className="bg-gradient-to-r from-[#0c1a30] via-[#112240] to-[#0a1426] p-6 text-white border-b border-sky-800/40 relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPost(null)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center font-bold text-sm shadow-lg transition"
                  >
                    ✕
                  </button>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 border border-sky-400/40 text-sky-300 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>Agenda Rencana Kunjungan</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {selectedPost.title}
                  </h3>
                  <p className="text-xs text-sky-200 mt-1">
                    Tanggal Rencana: <strong>{selectedPost.date || "Segera"}</strong> • Jam: <strong>{selectedPost.time || "08:00 - 12:00 WIB"}</strong> • Lokasi: <strong>{selectedPost.location}</strong>
                  </p>
                </div>
              );
            })()}

            {/* Content Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 ${
                    selectedPost.status === "SEDANG_BERLANGSUNG"
                      ? "bg-red-100 text-red-800 border border-red-300"
                      : selectedPost.status === "SUDAH_DIKUNJUNGI"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-sky-100 text-sky-800 border border-sky-300"
                  }`}
                >
                  {selectedPost.status === "SEDANG_BERLANGSUNG" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      <span>Sedang Berlangsung</span>
                    </>
                  ) : selectedPost.status === "SUDAH_DIKUNJUNGI" ? (
                    <span>Sudah Dikunjungi</span>
                  ) : (
                    <span>Akan Dikunjungi</span>
                  )}
                </span>

                <span className="text-slate-400">•</span>
                <span className="font-semibold text-slate-700">
                  {selectedPost.time || "08:00 - 12:00 WIB"}
                </span>

                <span className="text-slate-400">•</span>
                <span className="font-semibold text-[#4c7c38]">
                  {selectedPost.category}
                </span>

                <span className="text-slate-400">•</span>
                <span className="text-slate-500 font-medium">
                  {selectedPost.location}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {selectedPost.title}
              </h2>

              <div className="flex items-center gap-2 text-xs text-slate-500 pb-3 border-b border-slate-100 font-medium">
                <span>Sekolah: <strong>{selectedPost.schoolName || "-"}</strong></span>
                <span>•</span>
                <span>Penulis: <strong>{selectedPost.author}</strong></span>
              </div>

              {selectedPost.summary && (
                <div className="p-4 rounded-2xl bg-slate-50 border-l-4 border-[#4c7c38] text-xs font-medium text-slate-700 leading-relaxed italic">
                  &ldquo;{selectedPost.summary}&rdquo;
                </div>
              )}

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line">
                {selectedPost.content}
              </div>

              {/* Bagikan Berita Widget (Friendly Slug URL) */}
              {(() => {
                const modalSlug = toRoadshowSlug(selectedPost.schoolName, selectedPost.location) || selectedPost.id;
                const modalShareUrl = `https://www.ppikabupatenprobolinggo.id/roadshow/${modalSlug}`;
                return (
                  <div className="pt-2">
                    <RoadshowShareWidget
                      title={selectedPost.title}
                      url={modalShareUrl}
                      schoolName={selectedPost.schoolName}
                    />
                    <div className="flex justify-end pt-2">
                      <Link
                        href={`/roadshow/${modalSlug}`}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Buka Halaman Lengkap</span>
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Action Button: Jika Sekolah Ini Sudah Selesai & Ada Siswa Lolos */}
              {selectedPost.status === "SUDAH_DIKUNJUNGI" && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Ingin melihat daftar siswa yang lolos seleksi dari sekolah ini?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const matched = schools.find((s) =>
                        s.namaSekolah.toLowerCase().includes(selectedPost.schoolName.toLowerCase().trim())
                      );
                      if (matched) {
                        setSelectedSchoolId(matched.id);
                      }
                      setActiveMainTab("CANDIDATES");
                      setSelectedPost(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/30 transition flex items-center gap-2 shrink-0"
                  >
                    <span>Lihat Siswa Lolos Sekolah Ini</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
