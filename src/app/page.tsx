"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { UMUM_RTDB_URL } from "@/lib/firebase";
import { showConfirm, showError, showSuccess } from "@/lib/swal";

interface LandingConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaUrl: string;
  waAdminMerch: string;
  suratEdaranTitle?: string;
  suratEdaranDesc?: string;
  suratEdaranUrl?: string;
  suratEdaranVisible?: boolean;
  suratEdaranStatus?: string;
}

interface RoadshowScheduleItem {
  id: string;
  namaSekolah: string;
  lokasi: string;
  tanggal: string;
  statusPenilaian: string;
  sortOrder: number;
}

interface LandingItem {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  imageUrl: string;
  metaLocation: string;
  metaDay: string;
  metaDate: string;
}

interface ReviewItem {
  id: string;
  nama: string;
  kategori: string;
  angkatan: string;
  rating: number;
  pesan: string;
  source: string;
  createdAt: string;
}

interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  permissions: {
    manageLanding?: boolean;
    manageMerchandise?: boolean;
    manageReviews?: boolean;
    manageRoadshow?: boolean;
  };
}

// Format date with jam, menit, WIB sesuai request user
function formatReviewDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateFormatted} • ${timeFormatted} WIB`;
  } catch {
    return dateStr;
  }
}

export default function LandingPage() {
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [items, setItems] = useState<LandingItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [roadshowSchedule, setRoadshowSchedule] = useState<RoadshowScheduleItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [visitCount, setVisitCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Surat Edaran Modal State
  const [showSuratEdaranModal, setShowSuratEdaranModal] = useState(false);

  // Horizontal scroll ref for Galeri Dokumentasi Kegiatan
  const roadshowScrollRef = useRef<HTMLDivElement>(null);

  // Product Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<LandingItem | null>(null);

  // Admin CRUD Modal (Supports HERO_BUTTON, ROADSHOW_GALLERY, MERCHANDISE)
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LandingItem | null>(null);
  const [itemSection, setItemSection] = useState("ROADSHOW_GALLERY");
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemLocation, setItemLocation] = useState("");
  const [itemDay, setItemDay] = useState("");
  const [itemDate, setItemDate] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  const loadData = async () => {
    try {
      const [landingRes, authRes, roadshowRes] = await Promise.all([
        fetch("/api/landing", { cache: "no-store" }),
        fetch("/api/auth", { cache: "no-store" }),
        fetch("/api/roadshow?mode=public", { cache: "no-store" }),
      ]);
      if (landingRes.ok) {
        const data = await landingRes.json();
        setConfig(data.config);
        setItems(data.items || []);
        setReviews(data.reviews || []);
      }
      if (authRes.ok) {
        const authData = await authRes.json();
        setUser(authData.authenticated ? authData.user : null);
      }
      if (roadshowRes.ok) {
        const rsData = await roadshowRes.json();
        setRoadshowSchedule(rsData.schedule || []);
      }
    } catch (e) {
      console.error("Landing data load error:", e);
    }
  };

  useEffect(() => {
    loadData();

    // Increment visitor count on every visit to the website / landing page (base: 2410)
    const incrementVisitorCount = async () => {
      // 1. Try our native API endpoint
      try {
        const res = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === "number" && data.count >= 0) {
            setVisitCount(data.count);
            return;
          }
        }
      } catch {
        // Fallback below
      }

      // 2. Direct RTDB fetch & increment fallback
      const RTDB_URL = "https://cwu-gen-2-default-rtdb.firebaseio.com/system/visitorCount.json";
      try {
        const r = await fetch(RTDB_URL, { cache: "no-store" });
        const val = await r.json();
        const current = typeof val === "number" && val >= 0 ? val : 0;
        const nextVal = current + 1;
        setVisitCount(nextVal);
        fetch(RTDB_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextVal),
        }).catch(() => { });
      } catch {
        setVisitCount((prev) => Math.max(prev, 0) + 1);
      }
    };

    incrementVisitorCount();
  }, []);

  const canManageLanding = user?.role === "SUPER_ADMIN" || Boolean(user?.permissions?.manageLanding);
  const canManageMerch =
    user?.role === "SUPER_ADMIN" || Boolean(user?.permissions?.manageMerchandise) || canManageLanding;
  const canManageReviews =
    user?.role === "SUPER_ADMIN" || Boolean(user?.permissions?.manageReviews) || canManageLanding;

  const heroButtons = items.filter((i) => i.section === "HERO_BUTTON");
  const dbRoadshowItems = items.filter((i) => i.section === "ROADSHOW_GALLERY");
  const merchItems = items.filter((i) => i.section === "MERCHANDISE");

  // Gabungkan kartu galeri resmi (Roadshow, Penugasan, Pengukuhan, Sekolah) dengan item dinamis DB
  const allGalleryItems = useMemo(() => {
    const defaultGallery: LandingItem[] = [
      {
        id: "gal-1",
        section: "ROADSHOW_GALLERY",
        title: "Dokumentasi Roadshow Sekolah",
        subtitle: "",
        description: "Pemaparan materi seleksi & tes fisik awal di depan ratusan siswa aula sekolah.",
        price: "",
        imageUrl: "/sman1paiton.jpeg",
        metaLocation: "SMAN 1 Paiton",
        metaDay: "Roadshow Seleksi",
        metaDate: "2026 / 2027",
      },
      {
        id: "gal-2",
        section: "ROADSHOW_GALLERY",
        title: "Dokumentasi Penugasan Upacara Resmi",
        subtitle: "",
        description: "Momen sakral pengibaran Merah Putih di hadapan Bupati & Forkopimda Kab. Probolinggo.",
        price: "",
        imageUrl: "/background.jpg",
        metaLocation: "Alun-Alun Kraksaan",
        metaDay: "Detik-Detik Proklamasi",
        metaDate: "17 Agustus",
      },
      {
        id: "gal-3",
        section: "ROADSHOW_GALLERY",
        title: "Tradisi, Renungan Suci & Pengukuhan",
        subtitle: "",
        description: "Malam pengukuhan penuh khidmat, ikrar putra Indonesia, dan tradisi lintas angkatan.",
        price: "",
        imageUrl: "/bbshati.jpeg",
        metaLocation: "Pendopo Kabupaten",
        metaDay: "Malam Pengukuhan",
        metaDate: "Malam H-1",
      },
      {
        id: "gal-4",
        section: "ROADSHOW_GALLERY",
        title: "Roadshow SMAN 1 Gading",
        subtitle: "",
        description: "Sosialisasi tahapan seleksi calon paskibraka dan pengukuran tinggi & berat badan.",
        price: "",
        imageUrl: "/sman1gading.jpeg",
        metaLocation: "Kecamatan Gading",
        metaDay: "Sosialisasi Pelajar",
        metaDate: "2026",
      },
      {
        id: "gal-5",
        section: "ROADSHOW_GALLERY",
        title: "Roadshow SMAN 1 Krucil",
        subtitle: "",
        description: "Penjaringan bakat dan motivasi kedisiplinan pelajar wilayah lereng Argopuro.",
        price: "",
        imageUrl: "/sman1krucil.jpeg",
        metaLocation: "Kecamatan Krucil",
        metaDay: "Roadshow Seleksi",
        metaDate: "2026",
      },
      {
        id: "gal-6",
        section: "ROADSHOW_GALLERY",
        title: "Roadshow MAN 2 Probolinggo",
        subtitle: "",
        description: "Antusiasme pelajar madrasah aliyah dalam seleksi awal duta Paskibraka daerah.",
        price: "",
        imageUrl: "/man2prob.jpeg",
        metaLocation: "Kecamatan Pajarakan",
        metaDay: "Verifikasi Berkas",
        metaDate: "2026",
      },
      {
        id: "gal-7",
        section: "ROADSHOW_GALLERY",
        title: "Roadshow SMK SAQO Kraksaan",
        subtitle: "",
        description: "Pengarahan kesiapan mental dan kesamaptaan fisik calon peserta seleksi kabupaten.",
        price: "",
        imageUrl: "/smksaqo.jpeg",
        metaLocation: "Kecamatan Kraksaan",
        metaDay: "Sosialisasi Kejuruan",
        metaDate: "2026",
      },
    ];

    // Sisipkan item tambahan yang diupload admin melalui modal CRUD
    return [...defaultGallery, ...dbRoadshowItems];
  }, [dbRoadshowItems]);

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)
      : "5.0";

  // Scroll galeri secara halus dan proporsional (menggeser 1 tampilan kartu sekaligus)
  const scrollRoadshow = (direction: "left" | "right") => {
    if (!roadshowScrollRef.current) return;
    const container = roadshowScrollRef.current;
    const scrollDistance = Math.max(340, container.clientWidth * 0.7);
    container.scrollBy({
      left: direction === "left" ? -scrollDistance : scrollDistance,
      behavior: "smooth",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (/\.php[0-9]*$|\.phtml$|\.phar$/i.test(file.name)) {
      await showError("File PHP dilarang keras!");
      e.target.value = "";
      return;
    }
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        await showError(data.error || "Gagal upload gambar");
      } else {
        setItemImage(data.url);
      }
    } finally {
      setUploadingImg(false);
    }
  };

  const openAddItemModal = (section: string) => {
    setEditingItem(null);
    setItemSection(section);
    setItemTitle("");
    setItemSubtitle(section === "HERO_BUTTON" ? "https://" : "");
    setItemPrice("");
    setItemDesc(section === "HERO_BUTTON" ? "PRIMARY" : "");
    setItemImage("");
    setItemLocation("");
    setItemDay("");
    setItemDate("");
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: LandingItem) => {
    setEditingItem(item);
    setItemSection(item.section);
    setItemTitle(item.title);
    setItemSubtitle(item.subtitle || "");
    setItemPrice(item.price || "");
    setItemDesc(item.description || "");
    setItemImage(item.imageUrl || "");
    setItemLocation(item.metaLocation || "");
    setItemDay(item.metaDay || "");
    setItemDate(item.metaDate || "");
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (/\.php/i.test(itemTitle) || /\.php/i.test(itemSubtitle) || /\.php/i.test(itemDesc)) {
      await showError("Input tidak boleh mengandung file atau script .php!");
      return;
    }
    const method = editingItem ? "PUT" : "POST";
    const res = await fetch("/api/landing", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        id: editingItem?.id,
        section: itemSection,
        title: itemTitle,
        subtitle: itemSubtitle,
        price: itemPrice,
        description: itemDesc,
        imageUrl: itemImage,
        metaLocation: itemLocation,
        metaDay: itemDay,
        metaDate: itemDate,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError("Gagal Menyimpan", data.error || "Gagal menyimpan item");
      return;
    }
    setItemModalOpen(false);
    showSuccess("Berhasil Disimpan", "Konten landing page telah diperbarui.");
    loadData();
  };

  const handleDeleteItem = async (id: string, title: string) => {
    const confirmRes = await showConfirm("Konfirmasi Hapus", `Hapus item "${title}"?`);
    if (!confirmRes.isConfirmed) return;
    const res = await fetch(`/api/landing?type=item&id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await showSuccess("Terhapus", `"${title}" berhasil dihapus.`);
      loadData();
    } else {
      showError("Gagal Menghapus", "Terjadi kesalahan saat menghapus data.");
    }
  };

  const handleDeleteReview = async (id: string, nama: string) => {
    const confirmRes = await showConfirm("Hapus Ulasan", `Hapus ulasan dari "${nama}" secara permanen dari database?`);
    if (!confirmRes.isConfirmed) return;
    const res = await fetch(`/api/landing?type=review&id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await showSuccess("Ulasan Dihapus", "Ulasan berhasil dihapus dari database.");
      loadData();
    } else {
      showError("Gagal Menghapus", "Tidak memiliki izin atau sesi login Anda telah berakhir.");
    }
  };

  const directOrderWA = (name: string, price: string) => {
    const wa = config?.waAdminMerch || "6282228368042";
    const message = `Halo Admin PPI Store Kab. Probolinggo, saya ingin memesan atribut: *${name}* seharga Rp ${price}. Mohon informasi ketersediaan stok & ukuran. Terima kasih.`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0c] text-zinc-100 selection:bg-red-600 selection:text-white">
      {/* ===================================================================== */}
      {/* NAVBAR: FIXED GLASSMORPHISM DENGAN TOTAL KUNJUNGAN JELAS               */}
      {/* ===================================================================== */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0c]/85 backdrop-blur-md border-b border-white/10 px-5 lg:px-12 py-3 transition">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo, Identitas & Total Kunjungan */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <div className="relative shrink-0">
              <img
                src="/logo.jpg"
                alt="Logo PPI Kabupaten Probolinggo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-amber-400/50 shadow-md group-hover:scale-105 transition"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-600 border-2 border-zinc-950 rounded-full" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold tracking-wide text-xs sm:text-sm text-white block leading-tight truncate max-w-[150px] sm:max-w-none">
                PPI KAB. PROBOLINGGO
              </span>
              {/* TOTAL KUNJUNGAN JELAS TERPAMPANG DI NAVBAR */}
              <span className="text-[10px] sm:text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                {visitCount > 0 ? (
                  <span className="truncate">
                    <strong className="text-zinc-200">{visitCount.toLocaleString("id-ID")}</strong> Total Kunjungan
                  </span>
                ) : (
                  <span>Menghitung kunjungan...</span>
                )}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-zinc-300">
            <a href="#about" className="hover:text-white transition">Tentang</a>
            <a href="#visi-misi" className="hover:text-white transition">Visi &amp; Misi</a>
            <a href="#program" className="hover:text-white transition">Program</a>
            <a href="#prestasi" className="hover:text-white transition">Prestasi &amp; Ulasan</a>
            <a href="#galeri" className="hover:text-white transition">Galeri</a>
            <a href="#produk" className="hover:text-white transition">Merchandise</a>
            <a
              href="#pra-seleksi"
              className="px-3.5 py-1.5 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white transition font-bold"
            >
              Pengumuman Pra-Seleksi
            </a>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-md shadow-red-900/30 transition"
            >
              {user ? `Panel (${user.username})` : "Login Petugas"}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-semibold"
          >
            {mobileMenuOpen ? "Tutup" : "Menu"}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-zinc-800 flex flex-col gap-2.5 text-xs font-semibold text-zinc-300 pb-2">
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>Profil Organisasi</a>
            <a href="#visi-misi" onClick={() => setMobileMenuOpen(false)}>Visi &amp; Misi</a>
            <a href="#program" onClick={() => setMobileMenuOpen(false)}>Program Kerja</a>
            <a href="#prestasi" onClick={() => setMobileMenuOpen(false)}>Prestasi &amp; Ulasan</a>
            <a href="#galeri" onClick={() => setMobileMenuOpen(false)}>Galeri Kegiatan</a>
            <a href="#produk" onClick={() => setMobileMenuOpen(false)}>Merchandise PPI</a>
            <a
              href="#pra-seleksi"
              onClick={() => setMobileMenuOpen(false)}
              className="text-red-400 font-bold"
            >
              Pengumuman Kelulusan Pra-Seleksi
            </a>
            <Link
              href={user ? "/dashboard" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="mt-1 py-2 text-center rounded-xl bg-red-600 text-white font-bold"
            >
              {user ? `Buka Panel (${user.username})` : "Login Admin & Panitia"}
            </Link>
          </div>
        )}
      </nav>

      {/* ===================================================================== */}
      {/* 1. HERO SECTION (FOTO NATURAL, GRADIENT NETRAL, TANPA OVERLAY MERAH)  */}
      {/* ===================================================================== */}
      <header
        id="hero"
        className="relative w-full min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-5 pt-20 pb-12 text-center border-b border-zinc-900 overflow-hidden"
      >
        {/* Foto Formasi Paskibraka PDU Upacara Resmi Asli & Natural (Eager LCP Preloaded) */}
        <img
          src="/hero-paskibraka.jpg"
          alt="Formasi Paskibraka Kabupaten Probolinggo"
          loading="eager"
          decoding="sync"
          // @ts-ignore
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none scale-100"
        />
        {/* Gradient Gelap Netral (Bukan Merah!) Agar Foto Asli Tetap Alami dan Tulisan Terbaca Jelas */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-[#0a0a0c] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center justify-center space-y-4 px-2">
          {/* Badge Ringkas & Rapi */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[10px] sm:text-xs font-medium text-zinc-300 shadow-sm">
            <span>Purna Paskibraka Indonesia • Kab. Probolinggo</span>
          </div>

          {/* Headline Rapi & Tidak Berdesakan */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-xl">
            Paskibraka Kabupaten Probolinggo
          </h1>

          {/* Sub-headline Ringkas & Jelas */}
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-lg mx-auto drop-shadow font-normal">
            Pusat informasi resmi kegiatan, dokumentasi roadshow sekolah, serta verifikasi kelulusan
            pra-seleksi calon Paskibraka Kabupaten Probolinggo.
          </p>

          {/* Call-to-Action 2 Tombol Bersih & Proporsional */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full sm:w-auto">
            {/* Tombol 1: Cek Hasil Pra-Seleksi */}
            <Link
              href="/roadshow"
              className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-red-600 hover:bg-red-500 text-white transition shadow-md shadow-red-700/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>📋</span>
              <span>Cek Hasil Pra-Seleksi</span>
            </Link>

            {/* Tombol 2: Unduh Surat Edaran Resmi */}
            {config?.suratEdaranVisible !== false && (
              <button
                type="button"
                onClick={() => {
                  if (config?.suratEdaranUrl && config.suratEdaranUrl !== "#" && config.suratEdaranStatus === "Tersedia") {
                    window.open(config.suratEdaranUrl, "_blank");
                  } else {
                    setShowSuratEdaranModal(true);
                  }
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white backdrop-blur-md transition shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <span>📄</span>
                <span>{config?.suratEdaranTitle || "Unduh Surat Edaran"}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${config?.suratEdaranStatus === "Tersedia"
                    ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                    : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                  }`}>
                  {config?.suratEdaranStatus || "Segera Hadir"}
                </span>
              </button>
            )}

            {/* Tombol Tambahan Admin (Hanya jika login) */}
            {canManageLanding && (
              <button
                type="button"
                onClick={() => openAddItemModal("HERO_BUTTON")}
                className="px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-xs transition border border-emerald-400/30"
              >
                + Tombol
              </button>
            )}
          </div>
        </div>

        {/* Scroll Indicator */}
        <a
          href="#about"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-xs text-zinc-400 hover:text-white transition"
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll ke bawah</span>
          <span className="text-base animate-bounce">↓</span>
        </a>
      </header>

      {/* ===================================================================== */}
      {/* 2. SEKILAS PROFIL / TENTANG KAMI                                     */}
      {/* ===================================================================== */}
      <section id="about" className="py-20 px-5 bg-[#0a0a0c] border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider inline-block">
              Sekilas Profil
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Kawah Candradimuka Pemuda Kabupaten Probolinggo
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-red-600 to-amber-400 mx-auto rounded-full mt-2" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Kolom Kiri: Piagam & Emblem */}
            <div className="lg:col-span-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
                <div className="flex items-center gap-4">
                  <img
                    src="/logo.jpg"
                    alt="Logo PPI"
                    className="w-16 h-16 rounded-2xl object-cover border border-amber-400/40 shadow-md"
                  />
                  <div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      Purna Paskibraka Indonesia
                    </h3>
                    <p className="text-xs text-amber-300 font-medium">Kabupaten Probolinggo</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-300 border-t border-zinc-800/80 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Landasan: <strong>Panca Purna Paskibraka</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Mitra Resmi: <strong>Bakesbangpol Kab. Probolinggo</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Jangkauan: <strong>Pelajar SMA/SMK/MA Se-Kabupaten</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Narasi Lengkap Sesuai Permintaan */}
            <div className="lg:col-span-7 space-y-4 text-sm text-zinc-300 leading-relaxed">
              <p className="bg-zinc-900/60 border border-zinc-800/70 rounded-2xl p-5 sm:p-6">
                <strong>Paskibraka Kabupaten Probolinggo</strong> bersama{" "}
                <strong>Purna Paskibraka Indonesia (PPI) Kabupaten Probolinggo</strong> berperan aktif
                dalam membina putra-putri terbaik daerah dari berbagai pelosok SMA/SMK/MA
                se-Kabupaten Probolinggo.
              </p>
              <p className="bg-zinc-900/60 border border-zinc-800/70 rounded-2xl p-5 sm:p-6">
                Bukan sekadar baris-berbaris, pembinaan ini berlandaskan{" "}
                <em className="text-amber-300 font-semibold">Panca Purna Paskibraka</em> untuk
                menanamkan kedisiplinan militer non-kombatan, wawasan kebangsaan, kepemimpinan publik,
                serta ideologi Pancasila demi mencetak calon pemimpin masa depan Probolinggo yang
                berintegritas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. VISI & MISI                                                        */}
      {/* ===================================================================== */}
      <section id="visi-misi" className="py-20 px-5 bg-zinc-950 border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider inline-block">
              Komitmen Pengabdian
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Visi &amp; Misi Organisasi
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-red-600 to-amber-400 mx-auto rounded-full mt-2" />
          </div>

          {/* Visi Card */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center shadow-lg">
            <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold uppercase tracking-wider mb-3">
              Visi
            </span>
            <p className="text-base sm:text-xl font-bold text-white max-w-3xl mx-auto leading-relaxed italic">
              &ldquo;Terwujudnya kader muda Kabupaten Probolinggo yang berkarakter kuat, berwawasan
              nusantara, berjiwa Pancasila, dan berdisiplin tinggi demi kemajuan bangsa.&rdquo;
            </p>
          </div>

          {/* Misi 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {[
              {
                num: "01",
                title: "Pembinaan Karakter & Fisik",
                desc: "Melaksanakan pembinaan karakter, ideologi Pancasila, dan kesamaptaan fisik bagi pelajar Probolinggo.",
                icon: "🛡️",
              },
              {
                num: "02",
                title: "Pengawalan Penugasan Tingkat Lanjut",
                desc: "Mempersiapkan duta terbaik daerah untuk penugasan pengibaran bendera tingkat Kabupaten, Provinsi Jawa Timur, hingga Nasional.",
                icon: "🇮🇩",
              },
              {
                num: "03",
                title: "Persaudaraan & Solidaritas",
                desc: "Mempererat jejaring persaudaraan dan solidaritas antar-pemuda di seluruh penjuru Kabupaten Probolinggo.",
                icon: "🤝",
              },
              {
                num: "04",
                title: "Pengabdian Sosial Purna",
                desc: "Mendorong peran aktif purna dalam pengabdian sosial dan pembangunan kepemudaan daerah.",
                icon: "🌟",
              },
            ].map((m) => (
              <div
                key={m.num}
                className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex gap-4 hover:border-zinc-700 transition"
              >
                <div className="text-2xl shrink-0 p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 h-fit">
                  {m.icon}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono font-bold text-amber-400">MISI #{m.num}</div>
                  <h3 className="text-sm sm:text-base font-bold text-white">{m.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. PROGRAM KERJA & AGENDA LAPANGAN                                   */}
      {/* ===================================================================== */}
      <section id="program" className="py-20 px-5 bg-[#0a0a0c] border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider inline-block">
              Aksi Nyata Pemuda
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Program Kerja &amp; Agenda Lapangan
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-red-600 to-amber-400 mx-auto rounded-full mt-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                title: "Roadshow & Sosialisasi Sekolah",
                desc: "Kunjungan berkala tim PPI Kabupaten Probolinggo ke SMA/SMK/MA di berbagai kecamatan (Kraksaan, Dringu, Paiton, Tongas, Sukapura, dll.) untuk sosialisasi tahapan seleksi dan motivasi pelajar.",
                tag: "Tahunan",
              },
              {
                title: "Latihan Gabungan & Pra-Diklat",
                desc: "Pembinaan dasar kesamaptaan, postur tubuh, serta kesiapan mental bagi calon peserta sebelum memasuki tahapan seleksi resmi.",
                tag: "Intensif",
              },
              {
                title: "Penugasan Upacara Resmi",
                desc: "Pelaksanaan tugas kenegaraan upacara detik-detik Proklamasi 17 Agustus dan Hari Pahlawan di tingkat Pemkab Probolinggo.",
                tag: "Kenegaraan",
              },
              {
                title: "Bakti Sosial & Aksi Komunitas PPI",
                desc: "Kegiatan kemasyarakatan, aksi lingkungan hidup, dan program pengabdian pemuda di wilayah Probolinggo.",
                tag: "Sosial",
              },
            ].map((prog, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 hover:border-zinc-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300">
                    {prog.tag}
                  </span>
                  <span className="text-zinc-600 font-mono text-xs">PPI-PROB #{idx + 1}</span>
                </div>
                <h3 className="text-base font-bold text-white">{prog.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{prog.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. REKAM JEJAK, PRESTASI & ULASAN (LENGKAP DENGAN JAM:MENIT:TGL WIB)  */}
      {/* ===================================================================== */}
      <section id="prestasi" className="py-20 px-5 bg-zinc-950 border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider inline-block">
              Prestasi &amp; Apresiasi
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Rekam Jejak, Prestasi &amp; Ulasan
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-red-600 to-amber-400 mx-auto rounded-full mt-2" />
          </div>

          {/* 4 Statistik Utama */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Angkatan Alumni", value: "30+", sub: "Pengabdian Berkelanjutan" },
              { label: "Alumni Kedinasan", value: "Akmil / Akpol", sub: "IPDN & PTN Unggulan" },
              { label: "Jawa Timur", value: "Konsisten", sub: "Duta Provinsi Terpilih" },
              { label: "Jangkauan", value: "24", sub: "Kecamatan Se-Kabupaten" },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center space-y-1"
              >
                <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">{stat.label}</div>
                <div className="text-[11px] text-zinc-500">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Testimoni Unggulan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="text-amber-400 text-sm">★★★★★</div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic">
                  &ldquo;Mengikuti Paskibraka Probolinggo bukan cuma soal baris-berbaris, tapi tempat di
                  mana mental saya ditempa dari nol hingga paham arti loyalitas dan kepemimpinan.&rdquo;
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Purna Paskibraka Kab. Probolinggo</span>
                <span className="text-[10px] text-zinc-500">Alumni Purna</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="text-amber-400 text-sm">★★★★★</div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic">
                  &ldquo;Kehadiran tim Roadshow PPI di sekolah membuka wawasan para siswa tentang standar
                  fisik, kedisiplinan, dan persiapan masuk perguruan tinggi/kedinasan.&rdquo;
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Guru Pembina OSIS / Kesiswaan</span>
                <span className="text-[10px] text-zinc-500">SMA Mitra Roadshow</span>
              </div>
            </div>
          </div>

          {/* Summary Penilaian & Tombol Beri Penilaian */}
          <div id="penilaian-preview" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-left">
              <div className="text-3xl sm:text-4xl font-extrabold text-white">{avgRating}</div>
              <div>
                <div className="text-amber-400 text-xs sm:text-sm">★★★★★</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Dari <strong>{reviews.length}</strong> ulasan anggota &amp; masyarakat
                </div>
              </div>
            </div>

            <Link
              href="/penilaian"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider text-center transition shadow-md"
            >
              + Beri Penilaian / Ulasan
            </Link>
          </div>

          {/* Dynamic Reviews from DB: TAMPILKAN JAM, MENIT, TANGGAL WIB SESUAI PERMINTAAN */}
          {reviews.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-1">
              {reviews.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900/90 p-5 rounded-2xl border border-zinc-800/90 flex flex-col justify-between gap-3 text-left"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <strong className="text-white text-xs font-semibold truncate">{item.nama}</strong>
                        {item.kategori === "ppi" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-500/40">
                            {item.angkatan && item.angkatan !== "-"
                              ? (String(item.angkatan).toLowerCase().startsWith("ppi")
                                ? String(item.angkatan).toUpperCase()
                                : `PPI-${item.angkatan}`)
                              : "PPI"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                            Umum
                          </span>
                        )}
                      </div>
                      <span className="text-amber-400 text-xs font-bold shrink-0">★ {Number(item.rating || 5).toFixed(1)}</span>
                    </div>
                    <p className="text-zinc-300 text-xs leading-relaxed">&ldquo;{item.pesan}&rdquo;</p>
                  </div>

                  {/* FORMAT JAM, MENIT, TANGGAL WIB */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800">
                    <span className="font-mono text-zinc-400">
                      🕒 {formatReviewDateTime(item.createdAt)}
                    </span>
                    {canManageReviews && (
                      <button
                        onClick={() => handleDeleteReview(item.id, item.nama)}
                        className="text-red-400 hover:underline text-xs"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. GALERI DOKUMENTASI (SCROLL KANAN-KIRI MULUS + TOMBOL TERINTEGRASI) */}
      {/* ===================================================================== */}
      <section id="galeri" className="py-20 px-5 bg-[#0a0a0c] border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider inline-block mb-2">
                Dokumentasi Lapangan
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Galeri Dokumentasi Kegiatan
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Dokumentasi Roadshow Sekolah, Penugasan Upacara Resmi, serta Tradisi &amp; Kebersamaan PPI Kabupaten Probolinggo.
              </p>
            </div>

            {/* TOMBOL SCROLL KIRI & KANAN LANGSUNG MENGONTROL CAROUSEL */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => scrollRoadshow("left")}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-base transition shadow-sm active:scale-95"
                title="Geser Galeri ke Kiri"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollRoadshow("right")}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-base transition shadow-sm active:scale-95"
                title="Geser Galeri ke Kanan"
              >
                →
              </button>
              {canManageLanding && (
                <button
                  onClick={() => openAddItemModal("ROADSHOW_GALLERY")}
                  className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
                >
                  + Tambah Foto
                </button>
              )}
            </div>
          </div>

          {/* SATU WADAH CAROUSEL TERPADU (ROADSHOW, PENUGASAN, PENGUKUHAN, DLL BISA DI-SCROLL) */}
          <div
            ref={roadshowScrollRef}
            className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {allGalleryItems.map((item) => (
              <div
                key={item.id}
                className="snap-start shrink-0 w-[82vw] max-w-[340px] sm:w-[340px] group rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="relative h-56 overflow-hidden bg-zinc-950">
                    <img
                      src={item.imageUrl || "/sman1paiton.jpeg"}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
                        {item.metaDay || "Kegiatan PPI"}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                      <span>📍 {item.metaLocation || "Kab. Probolinggo"}</span>
                      {item.metaDate && <span>📅 {item.metaDate}</span>}
                    </div>
                  </div>
                </div>

                {canManageLanding && (
                  <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-2">
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.title)}
                      className="px-3 py-1 rounded-lg bg-red-500/15 text-xs text-red-400"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. OFFICIAL MERCHANDISE PPI KABUPATEN PROBOLINGGO                     */}
      {/* ===================================================================== */}
      <section id="produk" className="py-20 px-5 bg-zinc-950 border-b border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider inline-block mb-2">
                Atribut Resmi
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Official Merchandise PPI Kabupaten Probolinggo
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
                Dapatkan atribut resmi organisasi untuk mendukung identitas, kekompakan, dan pembiayaan mandiri
                kegiatan kepemudaan PPI Kabupaten Probolinggo.
              </p>
            </div>

            {canManageMerch && (
              <button
                onClick={() => openAddItemModal("MERCHANDISE")}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
              >
                + Tambah Atribut
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Kaos Polo Resmi PPI */}
            <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col justify-between group">
              <div
                onClick={() =>
                  setSelectedProduct({
                    id: "polo",
                    title: "Kaos Polo Resmi PPI Probolinggo",
                    description: "Bahan lacoste cotton premium bordir lambang garuda & PPI Kabupaten Probolinggo.",
                    price: "125.000",
                    imageUrl: "/polo.png",
                    section: "MERCHANDISE",
                    subtitle: "",
                    metaLocation: "",
                    metaDay: "",
                    metaDate: "",
                  })
                }
                className="cursor-pointer relative h-64 bg-zinc-950 p-6 flex items-center justify-center overflow-hidden"
              >
                <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs">
                  Rp 125.000
                </span>
                <img
                  src="/polo.png"
                  alt="Kaos Polo Resmi PPI"
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                />
              </div>
              <div className="p-5 space-y-3">
                <h3 className="text-base font-bold text-white">Kaos Polo Resmi PPI Probolinggo</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Bahan lacoste cotton premium dengan bordir lencana resmi. Nyaman untuk apel dan kegiatan lapangan.
                </p>
                <button
                  onClick={() => directOrderWA("Kaos Polo Resmi PPI Probolinggo", "125.000")}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  Pesan via WhatsApp PPI Store
                </button>
              </div>
            </div>

            {/* 2. PSH / Rompi Lapangan */}
            <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col justify-between group">
              <div
                onClick={() =>
                  setSelectedProduct({
                    id: "psh",
                    title: "Jaket / Rompi Lapangan PPI",
                    description: "Pakaian Dinas Harian & Rompi lapangan resmi pengurus PPI Kab. Probolinggo.",
                    price: "220.000",
                    imageUrl: "/psh.png",
                    section: "MERCHANDISE",
                    subtitle: "",
                    metaLocation: "",
                    metaDay: "",
                    metaDate: "",
                  })
                }
                className="cursor-pointer relative h-64 bg-zinc-950 p-6 flex items-center justify-center overflow-hidden"
              >
                <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs">
                  Rp 220.000
                </span>
                <img
                  src="/psh.png"
                  alt="Jaket Rompi PPI"
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                />
              </div>
              <div className="p-5 space-y-3">
                <h3 className="text-base font-bold text-white">Jaket / Rompi Lapangan PPI</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Jaket &amp; rompi lapangan resmi anti-angin untuk panitia seleksi roadshow sekolah.
                </p>
                <button
                  onClick={() => directOrderWA("Jaket / Rompi Lapangan PPI", "220.000")}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  Pesan via WhatsApp PPI Store
                </button>
              </div>
            </div>

            {/* 3. Kaos Latihan Roadshow */}
            <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col justify-between group">
              <div
                onClick={() =>
                  setSelectedProduct({
                    id: "kaos",
                    title: "Kaos Latihan Roadshow PPI",
                    description: "Kaos cotton combed 24s sablon plastisol tema Roadshow 2026/2027.",
                    price: "95.000",
                    imageUrl: "/kaos.png",
                    section: "MERCHANDISE",
                    subtitle: "",
                    metaLocation: "",
                    metaDay: "",
                    metaDate: "",
                  })
                }
                className="cursor-pointer relative h-64 bg-zinc-950 p-6 flex items-center justify-center overflow-hidden"
              >
                <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs">
                  Rp 95.000
                </span>
                <img
                  src="/kaos.png"
                  alt="Kaos Latihan Roadshow"
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                />
              </div>
              <div className="p-5 space-y-3">
                <h3 className="text-base font-bold text-white">Kaos Latihan Roadshow PPI</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Kaos latihan combed 24s tema Roadshow Seleksi Paskibraka Kabupaten Probolinggo.
                </p>
                <button
                  onClick={() => directOrderWA("Kaos Latihan Roadshow PPI", "95.000")}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  Pesan via WhatsApp PPI Store
                </button>
              </div>
            </div>

            {/* Item Dinamis DB Jika Ada */}
            {merchItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col justify-between"
              >
                <div
                  onClick={() => setSelectedProduct(item)}
                  className="cursor-pointer relative h-64 bg-zinc-950 p-6 flex items-center justify-center"
                >
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs">
                    Rp {item.price}
                  </span>
                  <img
                    src={item.imageUrl || "/polo.png"}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <h3 className="text-base font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.description}</p>
                  <button
                    onClick={() => directOrderWA(item.title, item.price)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                  >
                    Pesan via WhatsApp
                  </button>
                  {canManageMerch && (
                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => openEditItemModal(item)}
                        className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.title)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/15 text-xs text-red-400"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. PENGUMUMAN & ALUR PRA-SELEKSI (BERSIH: TABEL NAMA PESERTA DIHAPUS) */}
      {/* ===================================================================== */}
      <section id="pra-seleksi" className="py-20 px-5 bg-[#0a0a0c] border-b border-zinc-900">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Header & Kotak Pemberitahuan */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="px-3.5 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider inline-block">
              Pengumuman Kelulusan
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Pengumuman &amp; Alur Pra-Seleksi Kabupaten
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-red-600 to-amber-400 mx-auto rounded-full mt-2" />

            <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs sm:text-sm leading-relaxed text-center mt-3">
              <strong>Pemberitahuan:</strong> Seluruh data hasil pra-seleksi ditentukan langsung oleh{" "}
              <strong>Tim Penilai Panitia PPI Kabupaten Probolinggo</strong> berdasarkan hasil roadshow dan
              verifikasi lapangan.
            </div>
          </div>

          {/* Alur Seleksi 4 Tahap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "1",
                title: "Roadshow & Penjaringan Awal",
                desc: "Tim panitia turun langsung menyeleksi fisik dan postur di sekolah-sekolah se-kabupaten.",
              },
              {
                step: "2",
                title: "Sidang Kelulusan Pra-Seleksi",
                desc: "Panitia menetapkan nama-nama siswa yang memenuhi kriteria awal kabupaten.",
              },
              {
                step: "3",
                title: "Pengumuman Hasil",
                desc: "Peserta yang lolos dapat langsung mengecek status kelulusan melalui portal seleksi.",
              },
              {
                step: "4",
                title: "Surat Edaran & Akses BPIP",
                desc: "Peserta lolos mengunduh surat edaran dinas untuk pendaftaran akun seleksi pusat BPIP.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2 relative"
              >
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
                  {s.step}
                </div>
                <h4 className="text-sm font-bold text-white">{s.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Card Aksi Utama (Tabel nama dihapus dari landing page, tombol mandiri disediakan) */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-zinc-800 rounded-3xl p-7 sm:p-8 text-center space-y-6 shadow-xl">
            <div className="max-w-xl mx-auto space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Pengecekan Kelulusan Pra-Seleksi Siswa
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Daftar peserta yang dinyatakan lolos pra-seleksi per sekolah dapat diakses dan dicek langsung
                melalui halaman portal rekapitulasi Roadshow resmi.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3.5">
              {/* Tombol Cek Hasil Pra-Seleksi Mandiri */}
              <Link
                href="/roadshow"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-red-900/30 flex items-center gap-2 active:scale-95"
              >
                <span>🔍</span>
                <span>Cek Hasil Pra-Seleksi Sekolah →</span>
              </Link>

              {/* Tombol Unduh Surat Edaran */}
              {config?.suratEdaranVisible !== false && (
                <button
                  type="button"
                  onClick={() => {
                    if (config?.suratEdaranUrl && config.suratEdaranUrl !== "#" && config.suratEdaranStatus === "Tersedia") {
                      window.open(config.suratEdaranUrl, "_blank");
                    } else {
                      setShowSuratEdaranModal(true);
                    }
                  }}
                  className="px-5 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs sm:text-sm transition flex items-center gap-2"
                >
                  <span>📄</span>
                  <span>{config?.suratEdaranTitle || "Unduh Surat Edaran Resmi"}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${config?.suratEdaranStatus === "Tersedia"
                      ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    }`}>
                    {config?.suratEdaranStatus || "Segera Hadir"}
                  </span>
                </button>
              )}

              {/* Tombol Akses Portal BPIP */}
              <a
                href="https://paskibraka.bpip.go.id"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sky-400 hover:text-sky-300 font-semibold text-xs sm:text-sm transition flex items-center gap-1.5"
              >
                <span>Akses Portal BPIP Pusat</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* JADWAL RESMI KUNJUNGAN PPI ROADSHOW SEKOLAH                           */}
      {/* ===================================================================== */}
      {roadshowSchedule.length > 0 && (
        <section id="jadwal-roadshow" className="py-20 px-5 bg-[#09090b] border-b border-zinc-900">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="px-3 py-1 rounded-full bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider inline-block mb-2">
                  Agenda Resmi
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Jadwal Kunjungan PPI Roadshow
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Urutan resmi kunjungan tim sosialisasi dan pra-seleksi fisik calon Paskibraka ke SMA/SMK/MA se-Kabupaten Probolinggo.
                </p>
              </div>

              <Link
                href="/roadshow"
                className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-red-600/20"
              >
                Cek Hasil Kelulusan Siswa →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roadshowSchedule.map((s, idx) => {
                const isToday = s.statusPenilaian === "Hari Ini";
                const isDone = s.statusPenilaian === "Ditutup" || s.statusPenilaian === "Selesai";
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl p-5 border transition flex flex-col justify-between gap-4 ${isToday
                        ? "bg-gradient-to-b from-red-950/40 to-zinc-900 border-red-500/60 shadow-lg shadow-red-950/30 ring-1 ring-red-500/40"
                        : isDone
                          ? "bg-zinc-900/60 border-zinc-800/80"
                          : "bg-zinc-900 border-zinc-800"
                      }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-500">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${isToday
                              ? "bg-red-500 text-white animate-pulse"
                              : isDone
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                            }`}
                        >
                          {isToday ? "★ Sedang Berlangsung" : isDone ? "✓ Sudah Dikunjungi" : "⏳ Akan Dikunjungi"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white tracking-tight">
                        {s.namaSekolah}
                      </h3>

                      <div className="space-y-1 text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span>📅</span>
                          <span>{s.tanggal && s.tanggal !== "-" ? s.tanggal : "Menyesuaikan Jadwal"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>📍</span>
                          <span>{s.lokasi || "Kab. Probolinggo"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-400 font-medium">Status Pra-Seleksi:</span>
                      <span className="font-semibold text-zinc-300">
                        {isDone ? "Data Tersimpan" : isToday ? "Pengukuran Aktif" : "Menunggu Giliran"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* 9. FOOTER (KAKI HALAMAN)                                              */}
      {/* ===================================================================== */}
      <footer className="mt-auto border-t border-zinc-900 bg-[#070709] py-12 px-5 text-zinc-400">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Kolom 1: Lembaga */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.jpg"
                  alt="Logo PPI"
                  className="w-11 h-11 rounded-full object-cover border border-amber-400/40"
                />
                <div>
                  <h4 className="text-white font-bold text-sm leading-tight">
                    Purna Paskibraka Indonesia (PPI)
                  </h4>
                  <p className="text-xs text-amber-300">Kabupaten Probolinggo</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pengurus Kabupaten Purna Paskibraka Indonesia (PPI) Kabupaten Probolinggo bekerja sama
                dengan Badan Kesatuan Bangsa dan Politik (Bakesbangpol) Kabupaten Probolinggo.
              </p>
            </div>

            {/* Kolom 2: Kontak & Sekretariat */}
            <div className="md:col-span-4 space-y-2 text-xs">
              <h4 className="text-white font-bold text-sm">Sekretariat &amp; Helpdesk</h4>
              <p className="text-zinc-400">
                📍 Jl. Raya Dringu / Kompleks Perkantoran Pemkab Probolinggo, Jawa Timur.
              </p>
              <p className="text-zinc-400">
                📞 WhatsApp:{" "}
                <a
                  href="https://wa.me/6285176871609"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  0851-7687-1609 (Helpdesk Panitia PPI)
                </a>
              </p>
              <p className="text-zinc-400">
                ✉️ Email:{" "}
                <a
                  href="mailto:sekretariat@ppiprobolinggokab.org"
                  className="text-sky-400 hover:underline"
                >
                  sekretariat@ppiprobolinggokab.org
                </a>
              </p>
            </div>

            {/* Kolom 3: Media Sosial */}
            <div className="md:col-span-3 space-y-2 text-xs">
              <h4 className="text-white font-bold text-sm">Media Sosial Resmi</h4>
              <div className="space-y-1.5">
                <a
                  href="https://instagram.com/ppi_kabprobolinggo"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white transition"
                >
                  <span className="text-pink-400">📸</span>
                  <span>@ppi_kabprobolinggo</span>
                </a>
                <a
                  href="https://tiktok.com/@ppikabprobolinggo"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white transition"
                >
                  <span className="text-zinc-300">🎵</span>
                  <span>@ppikabprobolinggo</span>
                </a>
                <a
                  href="https://youtube.com/@ppikabupatenprobolinggo"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white transition"
                >
                  <span className="text-red-500">▶️</span>
                  <span>PPI Kabupaten Probolinggo Official</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
            <div>
              &copy; 2026 Purna Paskibraka Indonesia Kabupaten Probolinggo. Seluruh Hak Cipta Dilindungi.
            </div>
            <div className="flex items-center gap-5">
              <Link href="/roadshow" className="hover:text-zinc-300 transition">
                Rekap Roadshow
              </Link>
              <Link href="/penilaian" className="hover:text-zinc-300 transition">
                Form Penilaian
              </Link>
              <Link href="/biodata" className="hover:text-zinc-300 transition">
                Developer
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* MODAL: UNDUH SURAT EDARAN RESMI                                       */}
      {/* ===================================================================== */}
      {showSuratEdaranModal && config?.suratEdaranVisible !== false && (
        <div
          onClick={() => setShowSuratEdaranModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center justify-center text-xl mx-auto">
              📄
            </div>

            <div className="text-center space-y-1.5">
              <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config?.suratEdaranStatus === "Tersedia"
                  ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                }`}>
                Status: {config?.suratEdaranStatus || "Segera Hadir"}
              </span>
              <h3 className="text-lg font-bold text-white">
                {config?.suratEdaranTitle || "Surat Edaran Resmi Pra-Seleksi"}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {config?.suratEdaranDesc || "Surat Edaran kelulusan pra-seleksi saat ini dalam proses penandatanganan dan penomoran resmi Bakesbangpol Kabupaten Probolinggo."}
              </p>
            </div>

            {config?.suratEdaranUrl && config.suratEdaranStatus === "Tersedia" && (
              <a
                href={config.suratEdaranUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/30"
              >
                <span>📥</span>
                <span>Unduh File Surat Edaran Sekarang</span>
              </a>
            )}

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>📌</span>
                <span>Berkas Pendukung Terlampir:</span>
              </div>
              <div className="space-y-1 pl-5">
                <a
                  href="/PENGUMUMAN PENDAFTARAN PASKIBRAKA TH 2026 KAB PROBOLINGGO.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline block truncate"
                >
                  • Pengumuman Pendaftaran Paskibraka 2026 (PDF) ↗
                </a>
                <a
                  href="/Surat Sosialisasi Cabang Dinas dan Kemenag.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline block truncate"
                >
                  • Surat Sosialisasi Cabang Dinas &amp; Kemenag (PDF) ↗
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSuratEdaranModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: PRODUCT DETAIL MERCHANDISE                                     */}
      {/* ===================================================================== */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.title}
              className="w-full h-56 object-contain bg-zinc-950 rounded-xl p-4"
            />
            <div>
              <h3 className="text-xl font-bold text-white">{selectedProduct.title}</h3>
              <p className="text-amber-400 font-bold text-base mt-1">Rp {selectedProduct.price}</p>
              <p className="text-xs text-zinc-400 mt-2">{selectedProduct.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => directOrderWA(selectedProduct.title, selectedProduct.price)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Pesan via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADMIN CRUD MODAL (HERO_BUTTON, ROADSHOW_GALLERY, MERCHANDISE)         */}
      {/* ===================================================================== */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {itemSection === "HERO_BUTTON"
                ? editingItem
                  ? "Edit Tombol Utama Hero"
                  : "Tambah Tombol Utama Hero"
                : editingItem
                  ? "Edit Item & Gambar"
                  : "Tambah Item Baru"}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {itemSection === "HERO_BUTTON" ? "Teks Tombol" : "Judul / Nama"}
                </label>
                <input
                  type="text"
                  required
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder={itemSection === "HERO_BUTTON" ? "Contoh: Visit Profile BPIP" : ""}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                />
              </div>

              {itemSection === "HERO_BUTTON" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Link / URL Tujuan
                    </label>
                    <input
                      type="text"
                      required
                      value={itemSubtitle}
                      onChange={(e) => setItemSubtitle(e.target.value)}
                      placeholder="Contoh: https://paskibraka.bpip.go.id atau /roadshow"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Warna / Gaya Tombol
                    </label>
                    <select
                      value={itemDesc || "PRIMARY"}
                      onChange={(e) => setItemDesc(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    >
                      <option value="PRIMARY">Merah Utama (Primary)</option>
                      <option value="SECONDARY">Gelap / Outline (Secondary)</option>
                    </select>
                  </div>
                </>
              )}

              {itemSection === "MERCHANDISE" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Harga (Contoh: 100.000)
                    </label>
                    <input
                      type="text"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Deskripsi</label>
                    <textarea
                      rows={2}
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white"
                    />
                  </div>
                </>
              )}

              {itemSection !== "HERO_BUTTON" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Upload Gambar dari Perangkat (File .php Diblokir)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-500"
                  />
                  {uploadingImg && (
                    <span className="text-xs text-amber-400 block mt-1">Mengunggah gambar...</span>
                  )}
                  {itemImage && (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={itemImage}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => setItemImage("")}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Hapus Gambar Ini
                      </button>
                    </div>
                  )}
                </div>
              )}

              {itemSection === "ROADSHOW_GALLERY" && (
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Kecamatan"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Hari / Acara"
                    value={itemDay}
                    onChange={(e) => setItemDay(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Tanggal / Tahun"
                    value={itemDate}
                    onChange={(e) => setItemDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingImg}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
