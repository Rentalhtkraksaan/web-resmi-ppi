import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRoadshowSlug, getRoadshowShareUrl } from "@/lib/slug";
import RoadshowShareWidget from "@/components/RoadshowShareWidget";

interface PageProps {
  params: {
    slug: string;
  };
}

// Helper to find a post by flexible slug matching
async function getPostAndSchoolBySlug(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug).toLowerCase().trim();

  // 1. Fetch all published posts
  const allPosts = await prisma.roadshowPost.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Try direct slug match on posts
  let matchedPost = allPosts.find((p) => {
    const postSlug = toRoadshowSlug(p.schoolName, p.location);
    const postSchoolOnlySlug = toRoadshowSlug(p.schoolName);
    const postTitleSlug = toRoadshowSlug(p.title);
    return (
      postSlug === slug ||
      postSchoolOnlySlug === slug ||
      postTitleSlug === slug ||
      p.id.toLowerCase() === slug
    );
  });

  // 2. If not matched yet, try matching against schools
  const allSchools = await prisma.roadshowSchool.findMany({
    include: {
      candidates: {
        where: { hasilLulus: true, statusTayang: true },
        orderBy: [{ jenisKelamin: "desc" }, { kodePeserta: "asc" }],
      },
    },
  });

  let matchedSchool = allSchools.find((s) => {
    const schoolSlug = toRoadshowSlug(s.namaSekolah, s.lokasi);
    const schoolOnlySlug = toRoadshowSlug(s.namaSekolah);
    return schoolSlug === slug || schoolOnlySlug === slug || s.id.toLowerCase() === slug;
  });

  // If post found, find its corresponding school
  if (matchedPost && !matchedSchool) {
    if (matchedPost.schoolId) {
      matchedSchool = allSchools.find((s) => s.id === matchedPost!.schoolId);
    }
    if (!matchedSchool && matchedPost.schoolName) {
      const pName = matchedPost.schoolName.toLowerCase().trim();
      matchedSchool = allSchools.find(
        (s) =>
          s.namaSekolah.toLowerCase().trim() === pName ||
          s.namaSekolah.toLowerCase().includes(pName) ||
          pName.includes(s.namaSekolah.toLowerCase())
      );
    }
  }

  // If school found but no post directly matched, find post linked to this school
  if (!matchedPost && matchedSchool) {
    matchedPost = allPosts.find(
      (p) =>
        (p.schoolId && p.schoolId === matchedSchool!.id) ||
        p.schoolName.toLowerCase().trim() === matchedSchool!.namaSekolah.toLowerCase().trim()
    );

    // If still no post exists for this school, construct a virtual post so the link still works!
    if (!matchedPost) {
      matchedPost = {
        id: matchedSchool.id,
        title: `Kunjungan Roadshow Paskibraka di ${matchedSchool.namaSekolah}`,
        category: "Kunjungan Sekolah",
        status: matchedSchool.statusPenilaian === "Ditutup" ? "SUDAH_DIKUNJUNGI" : "AKAN_DIKUNJUNGI",
        schoolId: matchedSchool.id,
        schoolName: matchedSchool.namaSekolah,
        location: matchedSchool.lokasi,
        date: matchedSchool.tanggal || "Agustus 2026",
        imageUrl: matchedSchool.documentationPhoto || "",
        summary: `Liputan resmi kegiatan Roadshow Paskibraka Kabupaten Probolinggo di ${matchedSchool.namaSekolah}.`,
        content: `Tim Purna Paskibraka Indonesia (PPI) Kabupaten Probolinggo menyelenggarakan kegiatan Roadshow Sosialisasi dan Pra-Seleksi Calon Paskibraka di ${matchedSchool.namaSekolah}, berlokasi di ${matchedSchool.lokasi}. Kegiatan ini bertujuan untuk menjaring calon pandu pertiwi berkarakter, berdedikasi tinggi, dan memenuhi standar fisik serta wawasan kebangsaan.`,
        sortOrder: matchedSchool.sortOrder,
        isPublished: true,
        author: "Penjab Roadshow",
        createdAt: matchedSchool.createdAt,
        updatedAt: matchedSchool.createdAt,
      };
    }
  }

  // Related posts (excluding current)
  const relatedPosts = allPosts
    .filter((p) => p.id !== matchedPost?.id)
    .slice(0, 3);

  return {
    post: matchedPost || null,
    school: matchedSchool || null,
    relatedPosts,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { post } = await getPostAndSchoolBySlug(params.slug);

  if (!post) {
    return {
      title: "Berita Roadshow Tidak Ditemukan | PPI Kabupaten Probolinggo",
      description: "Halaman berita atau sekolah yang Anda tuju tidak ditemukan.",
    };
  }

  const shareUrl = `https://www.ppikabupatenprobolinggo.id/roadshow/${params.slug}`;
  const title = `${post.title} | PPI Kab. Probolinggo`;
  const description =
    post.summary ||
    post.content.slice(0, 160) ||
    `Berita dan hasil seleksi Roadshow PPI Kabupaten Probolinggo di ${post.schoolName}.`;

  const ogImages = post.imageUrl
    ? [
        {
          url: post.imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ]
    : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: "Purna Paskibraka Indonesia Kab. Probolinggo",
      images: ogImages,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.imageUrl ? [post.imageUrl] : [],
    },
  };
}

export default async function RoadshowDetailPage({ params }: PageProps) {
  const { post, school, relatedPosts } = await getPostAndSchoolBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const isSudah = post.status === "SUDAH_DIKUNJUNGI";
  const shareSlug = toRoadshowSlug(post.schoolName, post.location) || params.slug;
  const canonicalUrl = `https://www.ppikabupatenprobolinggo.id/roadshow/${shareSlug}`;

  const passedCandidates = school?.candidates || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col selection:bg-red-600 selection:text-white">
      {/* ===================================================================== */}
      {/* 1. TOP NAVBAR BRANDING PPI                                             */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/roadshow" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-md shadow-emerald-900/30 flex items-center justify-center">
              <span className="text-white font-black text-xs">PPI</span>
            </div>
            <div>
              <div className="text-xs font-black tracking-wide text-white group-hover:text-red-400 transition">
                ROADSHOW PASKIBRAKA 2026
              </div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                Kabupaten Probolinggo
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/roadshow"
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition"
            >
              Semua Berita
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition shadow-md shadow-red-600/30"
            >
              Beranda Utama
            </Link>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. BREADCRUMB & HEADER BANNER                                         */}
      {/* ===================================================================== */}
      <section className="bg-gradient-to-r from-[#173019] via-[#244220] to-[#173019] border-b border-emerald-900/50 px-4 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-2">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs text-emerald-200/80 font-medium">
            <Link href="/" className="hover:underline">Beranda</Link>
            <span>/</span>
            <Link href="/roadshow" className="hover:underline">Roadshow</Link>
            <span>/</span>
            <span className="text-white font-bold truncate max-w-[220px] sm:max-w-md">
              {post.schoolName || post.title}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isSudah
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
                  : "bg-sky-600 text-white shadow-md shadow-sky-900/40"
              }`}
            >
              {isSudah ? "Sudah Dikunjungi" : "Akan Dikunjungi"}
            </span>

            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white/10 text-emerald-100 border border-white/15">
              {post.category}
            </span>

            <span className="text-xs text-emerald-200/80 font-mono">
              📅 {post.date || "Agustus 2026"}
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. MAIN ARTICLE CONTAINER                                             */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-zinc-200 text-slate-900 space-y-6">
          {/* Article Header */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <span className="text-[#4c7c38] font-bold">🏫 {post.schoolName || "Sekolah Mitra"}</span>
              <span>•</span>
              <span>📍 {post.location}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 leading-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium pt-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                  PPI
                </span>
                <span>Oleh: <strong>{post.author || "Penjab Roadshow"}</strong></span>
                <span>•</span>
                <span>Diterbitkan: <strong>{post.date || "2026"}</strong></span>
              </div>
            </div>
          </div>

          {/* Documentation Photo */}
          {post.imageUrl && (
            <div className="space-y-2">
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 shadow-xl border border-slate-200">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 sm:p-6 text-white">
                  <p className="text-xs sm:text-sm font-semibold drop-shadow">
                    Dokumentasi resmi Roadshow PPI Kab. Probolinggo di {post.schoolName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Lead / Quote */}
          {post.summary && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border-l-4 border-emerald-600 text-slate-800 text-sm sm:text-base font-medium leading-relaxed italic">
              &ldquo;{post.summary}&rdquo;
            </div>
          )}

          {/* Full Article Content */}
          <div className="text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line font-normal">
            {post.content}
          </div>

          {/* Interactive Share Widget */}
          <RoadshowShareWidget
            title={post.title}
            url={canonicalUrl}
            schoolName={post.schoolName}
          />

          {/* ================================================================= */}
          {/* 4. RESULTS SECTION: SISWA LOLOS SELEKSI DARI SEKOLAH INI           */}
          {/* ================================================================= */}
          {passedCandidates.length > 0 && (
            <div className="mt-8 pt-8 border-t border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <span>🏆 Daftar Siswa Lolos Seleksi Roadshow</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Peserta dari {post.schoolName} yang dinyatakan memenuhi kualifikasi fisik awal
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 self-start sm:self-auto">
                  {passedCandidates.length} Siswa Lolos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {passedCandidates.map((c) => {
                  const isCewek = c.jenisKelamin === "Cewek";
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 hover:border-emerald-500 transition shadow-sm"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="block text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                          Kode: {c.kodePeserta}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {c.nama}
                        </h4>
                        <div className="text-[11px] text-slate-500 font-medium">
                          BB: {c.beratBadan} kg • TB: {c.tinggiBadan} cm
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                          isCewek
                            ? "bg-pink-100 text-pink-700 border border-pink-200"
                            : "bg-blue-100 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {c.jenisKelamin}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        {/* ===================================================================== */}
        {/* 5. BERITA ROADSHOW LAINNYA                                            */}
        {/* ===================================================================== */}
        {relatedPosts.length > 0 && (
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                📰 Kabar Roadshow Sekolah Lainnya
              </h3>
              <Link
                href="/roadshow"
                className="text-xs font-bold text-red-400 hover:text-red-300 transition"
              >
                Lihat Semua Berita
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedPosts.map((rp) => {
                const rpSlug = toRoadshowSlug(rp.schoolName, rp.location) || rp.id;
                return (
                  <Link
                    key={rp.id}
                    href={`/roadshow/${rpSlug}`}
                    className="group bg-zinc-900 hover:bg-zinc-850 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
                        <span className="text-emerald-400">{rp.category}</span>
                        <span>{rp.date}</span>
                      </div>
                      <h4 className="text-sm font-black text-white group-hover:text-red-400 transition line-clamp-2">
                        {rp.title}
                      </h4>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {rp.summary || rp.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 text-xs font-bold text-zinc-500 group-hover:text-white transition flex items-center justify-between">
                      <span className="truncate max-w-[150px]">🏫 {rp.schoolName}</span>
                      <span>Baca</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-center text-xs text-zinc-500 space-y-2">
        <p className="font-semibold text-zinc-400">
          Purna Paskibraka Indonesia (PPI) Kabupaten Probolinggo
        </p>
        <p className="text-[11px] text-zinc-600">
          Official Portal Berita &amp; Roadshow Seleksi Paskibraka 2026
        </p>
      </footer>
    </div>
  );
}

