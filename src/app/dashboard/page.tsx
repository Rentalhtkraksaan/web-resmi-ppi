"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import PaskibrakaAuthSplit from "@/components/PaskibrakaAuthSplit";
import {
  LayoutDashboard,
  Users,
  FileText,
  Image as ImageIcon,
  ShoppingBag,
  Eye,
  Settings,
  LogOut,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  QrCode,
  Calendar,
  CheckCircle,
  Shield,
  HelpCircle,
  MessageSquare,
  Phone,
  Lock,
  Unlock,
  Check,
  X,
  ChevronDown,
  Sparkles,
  School,
  Camera,
  Layers,
  Search,
  KeyRound,
  AlertCircle,
  BadgeCheck,
} from "lucide-react";

interface RolePermissions {
  inputBB?: boolean;
  inputTB?: boolean;
  inputRegistrasi?: boolean;
  manageLanding?: boolean;
  manageMerchandise?: boolean;
  manageReviews?: boolean;
  manageRoadshow?: boolean;
}

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  angkatan: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  permissions: RolePermissions;
}

interface ManagedAccount {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  angkatan: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  permissions: RolePermissions;
}

type NavSection =
  | "OVERVIEW"
  | "ROADSHOW"
  | "USERS"
  | "MERCH"
  | "GALLERY"
  | "LANDING"
  | "REVIEWS"
  | "SETTINGS"
  | "GUIDE";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Navigation Tab
  const [activeNav, setActiveNav] = useState<NavSection>("OVERVIEW");

  // Chart Timeframe Filter ("Harian" | "Mingguan" | "Bulanan")
  const [chartFilter, setChartFilter] = useState<"Harian" | "Mingguan" | "Bulanan">("Bulanan");
  const [chartYear, setChartYear] = useState("2026");

  // Data States
  const [config, setConfig] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [roadshowSchools, setRoadshowSchools] = useState<any[]>([]);
  const [todaySchoolId, setTodaySchoolId] = useState<string>("");
  const [qrModalSchool, setQrModalSchool] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Live Visitor Count (base: 2410)
  const [visitorCount, setVisitorCount] = useState<number>(0);

  // Search Filter for Users
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<ManagedAccount | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  // Form Add Item + Upload Image (Merchandise & Gallery)
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemLocation, setItemLocation] = useState("");
  const [itemDay, setItemDay] = useState("");
  const [itemDate, setItemDate] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  // Form Add Hero Button
  const [heroBtnText, setHeroBtnText] = useState("");
  const [heroBtnUrl, setHeroBtnUrl] = useState("");
  const [heroBtnStyle, setHeroBtnStyle] = useState("PRIMARY");

  // Form Create Account
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAngkatan, setNewAngkatan] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "USER" | "SUPER_ADMIN">("USER");
  const [newPerms, setNewPerms] = useState<RolePermissions>({
    inputBB: true,
    inputTB: false,
    inputRegistrasi: false,
    manageMerchandise: false,
    manageRoadshow: false,
    manageLanding: false,
    manageReviews: false,
  });

  const loadAll = async () => {
    try {
      const authRes = await fetch("/api/auth", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData.authenticated || !authData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const currentUser: AuthUser = authData.user;
      setUser(currentUser);

      const landingRes = await fetch("/api/landing", { cache: "no-store" });
      if (landingRes.ok) {
        const lData = await landingRes.json();
        setConfig(lData.config);
        setItems(lData.items || []);
        setReviews(lData.reviews || []);
      }

      if (currentUser.role === "SUPER_ADMIN") {
        const [uRes, rsRes] = await Promise.all([
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/roadshow?mode=internal", { cache: "no-store" }),
        ]);
        if (uRes.ok) {
          const uData = await uRes.json();
          setAccounts(uData.users || []);
        }
        if (rsRes.ok) {
          const rsData = await rsRes.json();
          setRoadshowSchools(rsData.schools || []);
          setTodaySchoolId(rsData.todaySchoolId || "");
        }
      }

      // Sync Visitor Count (base: 2410)
      try {
        const vRes = await fetch("/api/visitors", { cache: "no-store" }).catch(() => null);
        if (vRes && vRes.ok) {
          const vData = await vRes.json();
          if (typeof vData.count === "number" && vData.count >= 0) {
            setVisitorCount(vData.count);
          }
        } else {
          const rtdbRes = await fetch(
            "https://cwu-gen-2-default-rtdb.firebaseio.com/system/visitorCount.json",
            { cache: "no-store" }
          );
          if (rtdbRes.ok) {
            const rtdbData = await rtdbRes.json();
            if (typeof rtdbData === "number" && rtdbData >= 0) {
              setVisitorCount(rtdbData);
            }
          }
        }
      } catch {
        // fallback ok
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!qrModalSchool?.qrPayload) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(qrModalSchool.qrPayload, {
      width: 340,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [qrModalSchool]);

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout", rating: 5, pesan: "Selesai bertugas." }),
    });
    setUser(null);
  };

  const isSuper = user?.role === "SUPER_ADMIN";
  const canLanding = isSuper || Boolean(user?.permissions?.manageLanding);
  const canMerch = isSuper || Boolean(user?.permissions?.manageMerchandise) || canLanding;
  const canReviews = isSuper || Boolean(user?.permissions?.manageReviews) || canLanding;
  const canRoadshow = isSuper || Boolean(user?.permissions?.manageRoadshow);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetItem?: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (/\.php[0-9]*$|\.phtml$|\.phar$/i.test(file.name)) {
      alert("File PHP dilarang!");
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
        alert(data.error || "Gagal upload gambar");
        return;
      }
      if (targetItem) {
        await fetch("/api/landing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "item",
            id: targetItem.id,
            imageUrl: data.url,
          }),
        });
        loadAll();
      } else {
        setItemImage(data.url);
      }
    } finally {
      setUploadingImg(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent, section: string) => {
    e.preventDefault();
    const res = await fetch("/api/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        section,
        title: itemTitle,
        price: itemPrice,
        description: itemDesc,
        imageUrl: itemImage,
        metaLocation: itemLocation,
        metaDay: itemDay,
        metaDate: itemDate,
      }),
    });
    if (res.ok) {
      setItemTitle("");
      setItemPrice("");
      setItemDesc("");
      setItemImage("");
      setItemLocation("");
      setItemDay("");
      setItemDate("");
      loadAll();
    } else {
      const d = await res.json();
      alert(d.error || "Gagal menyimpan");
    }
  };

  const handleQuickUpdateItem = async (item: any, field: string, value: string) => {
    await fetch("/api/landing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        id: item.id,
        [field]: value,
      }),
    });
    loadAll();
  };

  const handleDeleteItem = async (id: string, title: string) => {
    if (!confirm(`Hapus "${title}"?`)) return;
    await fetch(`/api/landing?type=item&id=${id}`, { method: "DELETE" });
    loadAll();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        fullName: newFullName,
        email: newEmail,
        phone: newPhone,
        angkatan: newAngkatan,
        role: newRole,
        permissions: newPerms,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Gagal membuat akun");
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewFullName("");
    setNewEmail("");
    setNewPhone("");
    setNewAngkatan("");
    setShowAddUserModal(false);
    loadAll();
  };

  const handleToggleAccountPermission = async (acc: ManagedAccount, permKey: keyof RolePermissions) => {
    const updatedPerms = {
      ...acc.permissions,
      [permKey]: !acc.permissions?.[permKey],
    };
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: acc.id,
        permissions: updatedPerms,
      }),
    });
    loadAll();
  };

  const handleChangeAccountRole = async (acc: ManagedAccount, nextRole: "USER" | "ADMIN" | "SUPER_ADMIN") => {
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: acc.id,
        role: nextRole,
      }),
    });
    loadAll();
  };

  const handleDeleteAccount = async (acc: ManagedAccount) => {
    if (!confirm(`Hapus akun "${acc.fullName}"?`)) return;
    await fetch(`/api/users?id=${acc.id}`, { method: "DELETE" });
    loadAll();
  };

  // Helper Stats Calculation
  const totalSuperAdmins = accounts.filter((a) => a.role === "SUPER_ADMIN" || a.role === "ADMIN").length;
  const totalStaffUsers = accounts.filter((a) => a.role === "USER").length;
  const merchItems = items.filter((i) => i.section === "MERCHANDISE");
  const galleryItems = items.filter((i) => i.section === "ROADSHOW_GALLERY");
  const totalCandidatesPassed = useMemo(() => {
    return roadshowSchools.reduce((acc, curr) => acc + (curr.passedCount || 0), 0);
  }, [roadshowSchools]);

  // Filtered Users List
  const filteredAccounts = useMemo(() => {
    if (!userSearchQuery.trim()) return accounts;
    const q = userSearchQuery.toLowerCase().trim();
    return accounts.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
    );
  }, [accounts, userSearchQuery]);

  // Chart data simulation points for SVG rendering
  const chartPoints = useMemo(() => {
    if (chartFilter === "Harian") {
      return [
        { label: "Sen", val: 45 },
        { label: "Sel", val: 68 },
        { label: "Rab", val: 92 },
        { label: "Kam", val: 110 },
        { label: "Jum", val: 145 },
        { label: "Sab", val: 210 },
        { label: "Min", val: 279 },
      ];
    }
    if (chartFilter === "Mingguan") {
      return [
        { label: "Mg 1", val: 120 },
        { label: "Mg 2", val: 180 },
        { label: "Mg 3", val: 230 },
        { label: "Mg 4", val: 279 },
      ];
    }
    // Bulanan (Jan - Des)
    return [
      { label: "Jan", val: 0 },
      { label: "Feb", val: 0 },
      { label: "Mar", val: 0 },
      { label: "Apr", val: 0 },
      { label: "Mei", val: 0 },
      { label: "Jun", val: 0 },
      { label: "Jul", val: 0 },
      { label: "Ags", val: 15 },
      { label: "Sep", val: 279 },
      { label: "Okt", val: 32 },
      { label: "Nov", val: 84 },
      { label: "Des", val: 14 },
    ];
  }, [chartFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1322] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide">Memuat Control Panel PPI...</span>
      </div>
    );
  }

  // Not Logged In: Show Clean Split Auth Component
  if (!user) {
    return <PaskibrakaAuthSplit initialMode="LOGIN" onSuccess={() => loadAll()} />;
  }

  // User Initials
  const userInitials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col lg:flex-row text-slate-800 antialiased font-sans">
      {/* ===================================================================== */}
      {/* 1. SIDEBAR NAVIGASI (DEEP NAVY ALA CONTROL PANEL DISHUB KAB. PROB)    */}
      {/* ===================================================================== */}
      <aside className="w-full lg:w-64 bg-[#0c1322] border-r border-slate-800/90 text-slate-300 flex flex-col justify-between shrink-0 select-none shadow-2xl">
        <div className="p-4 space-y-6">
          {/* Top Profile Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md shrink-0">
              {userInitials}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-white truncate block">
                  {user.username}
                </span>
                <span className="text-blue-400 text-xs shrink-0">✓</span>
              </div>
              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black tracking-wider uppercase mt-0.5">
                {user.role}
              </span>
            </div>
          </div>

          {/* Nav Section: MENU UTAMA & DATA */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
              Menu Utama &amp; Data
            </div>

            <button
              onClick={() => setActiveNav("OVERVIEW")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeNav === "OVERVIEW"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/70"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard Utama</span>
            </button>

            {canRoadshow && (
              <button
                onClick={() => setActiveNav("ROADSHOW")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "ROADSHOW"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <School className="w-4 h-4 shrink-0" />
                <span>Roadshow &amp; Barcode QR</span>
              </button>
            )}

            {canMerch && (
              <button
                onClick={() => setActiveNav("MERCH")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "MERCH"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>Official Merchandise</span>
              </button>
            )}

            {canLanding && (
              <button
                onClick={() => setActiveNav("GALLERY")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "GALLERY"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>Album Galeri Foto</span>
              </button>
            )}
          </div>

          {/* Nav Section: KONTEN & TAMPILAN WEB */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
              Konten &amp; Tampilan Web
            </div>

            {canLanding && (
              <button
                onClick={() => setActiveNav("LANDING")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "LANDING"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Kelola Halaman Web</span>
              </button>
            )}

            {canReviews && (
              <button
                onClick={() => setActiveNav("REVIEWS")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "REVIEWS"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Ulasan &amp; Testimoni ({reviews.length})</span>
              </button>
            )}
          </div>

          {/* Nav Section: LAYANAN & PENGATURAN */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
              Layanan &amp; Pengaturan
            </div>

            {isSuper && (
              <button
                onClick={() => setActiveNav("USERS")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeNav === "USERS"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/70"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Akun Pengguna &amp; Petugas</span>
              </button>
            )}

            <button
              onClick={() => setActiveNav("SETTINGS")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeNav === "SETTINGS"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/70"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Pengaturan Website</span>
            </button>

            <button
              onClick={() => setActiveNav("GUIDE")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeNav === "GUIDE"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/70"
              }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Buku Panduan Petugas</span>
            </button>
          </div>

          {/* Nav Section: PUBLIC PORTAL */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
              Public Portal
            </div>

            <Link
              href="/"
              target="_blank"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900/70 transition"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Lihat Website Utama</span>
            </Link>
          </div>
        </div>

        {/* Bottom Section: Logout Button */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Panel</span>
          </button>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* 2. AREA KONTEN UTAMA (HEADER PUTIH BERSIH + KANVAS SLATE MODERN)      */}
      {/* ===================================================================== */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200/80 px-6 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-sm shrink-0">
              <img
                src="/logo.jpg"
                alt="Logo PPI"
                className="w-full h-full object-cover rounded-full bg-slate-900"
              />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                {activeNav === "OVERVIEW" && "Dashboard Overview"}
                {activeNav === "ROADSHOW" && "Manajemen Roadshow & Barcode"}
                {activeNav === "USERS" && "Manajemen Pengguna & Hak Akses"}
                {activeNav === "MERCH" && "Manajemen Official Merchandise"}
                {activeNav === "GALLERY" && "Album Galeri Dokumentasi"}
                {activeNav === "LANDING" && "Kelola Konten & Tombol Hero"}
                {activeNav === "REVIEWS" && "Kelola Ulasan & Testimoni"}
                {activeNav === "SETTINGS" && "Pengaturan Umum Website"}
                {activeNav === "GUIDE" && "Panduan Operasional Panitia"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Control Panel PPI Kabupaten Probolinggo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Button to Roadshow Scanner */}
            <Link
              href="/ppi-roadshow-27"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold transition shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Buka Pos Roadshow</span>
            </Link>

            {/* Profile Chip Right */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <span className="block text-xs font-bold text-slate-900">
                  {user.username} <span className="text-blue-500">✓</span>
                </span>
                <span className="block text-[10px] text-slate-500 font-semibold uppercase">
                  {user.role}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shadow-xs">
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="p-5 sm:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
          {/* =================================================================== */}
          {/* TAB 1: DASHBOARD OVERVIEW (SESUAI SCREENSHOT 1 DISHUB)               */}
          {/* =================================================================== */}
          {activeNav === "OVERVIEW" && (
            <div className="space-y-6">
              {/* Green Success Alert */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm shadow-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Akses Superadmin Berhasil!</strong> Anda telah terhubung ke Control Panel PPI Kabupaten Probolinggo dengan hak akses penuh.
                </span>
              </div>

              {/* Big Hero Welcome Card (Deep Midnight Blue Gradient) */}
              <div className="bg-gradient-to-r from-[#172554] via-[#1e293b] to-[#0f172a] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-700/50">
                {/* Watermark Logo Icon behind */}
                <div className="absolute right-4 -bottom-8 opacity-10 text-white pointer-events-none">
                  <Shield className="w-72 h-72" />
                </div>

                <div className="relative z-10 max-w-2xl space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-extrabold text-blue-300 uppercase tracking-widest">
                    <span>CONTROL PANEL PPI SYSTEM</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Selamat Datang, {user.fullName || user.username}! 👋
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                    Anda masuk sebagai <strong className="text-amber-300">{user.role}</strong>. Anda memiliki akses penuh untuk mengelola seluruh data roadshow sekolah, data kelulusan calon Paskibraka, album galeri foto, merchandise resmi, ulasan, serta hak akses pengguna internal.
                  </p>
                </div>
              </div>

              {/* 4 Metric KPI Stat Cards (Screenshot 1 Style) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* Card 1: Sekolah Roadshow */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500">
                      Sekolah Roadshow
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {roadshowSchools.length || 24}
                    </span>
                  </div>
                </div>

                {/* Card 2: Kandidat Lolos */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500">
                      Kandidat Terdata
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {totalCandidatesPassed > 0 ? totalCandidatesPassed : "140+"}
                    </span>
                  </div>
                </div>

                {/* Card 3: Banner & Galeri */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500">
                      Banner &amp; Foto Galeri
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {galleryItems.length || 12}
                    </span>
                  </div>
                </div>

                {/* Card 4: Total Pembaca Web */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500">
                      Total Pembaca Web
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {visitorCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Website Visitor Analytics Chart Card (Screenshot 1 Exact Diagram) */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <h3 className="text-base font-extrabold text-slate-900">
                        Statistik Pengunjung Website
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total Kunjungan: <strong className="text-slate-900">{visitorCount} views</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Year Selector */}
                    <select
                      value={chartYear}
                      onChange={(e) => setChartYear(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                    >
                      <option value="2026">Tahun 2026</option>
                      <option value="2025">Tahun 2025</option>
                    </select>

                    {/* Filter Pills */}
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                      {(["Harian", "Mingguan", "Bulanan"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setChartFilter(filter)}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                            chartFilter === filter
                              ? "bg-white text-blue-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SVG Graph Diagram */}
                <div className="space-y-2">
                  <div className="text-center text-xs font-semibold text-slate-400">
                    Diagram Statistik Pengunjung Website
                  </div>

                  <div className="relative w-full h-64 sm:h-72 pt-4">
                    <svg
                      viewBox="0 0 1000 300"
                      className="w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      {[0, 50, 100, 150, 200, 250, 300].map((yVal, idx) => {
                        const yPos = 260 - (yVal / 300) * 220;
                        return (
                          <g key={idx}>
                            <line
                              x1="40"
                              y1={yPos}
                              x2="980"
                              y2={yPos}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <text
                              x="30"
                              y={yPos + 4}
                              textAnchor="end"
                              className="text-[10px] fill-slate-400 font-mono"
                            >
                              {yVal}
                            </text>
                          </g>
                        );
                      })}

                      {/* Line & Area Points */}
                      {(() => {
                        const pts = chartPoints.map((p, idx) => {
                          const x = 60 + (idx / (chartPoints.length - 1)) * 900;
                          const y = 260 - (p.val / 300) * 220;
                          return { x, y, label: p.label, val: p.val };
                        });

                        const pathD = pts.reduce(
                          (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                          ""
                        );
                        const areaD = `${pathD} L ${pts[pts.length - 1].x} 260 L ${pts[0].x} 260 Z`;

                        return (
                          <>
                            {/* Area Fill */}
                            <path d={areaD} fill="url(#chartGradient)" />
                            {/* Line */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Points */}
                            {pts.map((pt, idx) => (
                              <g key={idx} className="group cursor-pointer">
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="5"
                                  className="fill-white stroke-blue-600 stroke-2 transition hover:scale-125"
                                />
                                {pt.val > 0 && (
                                  <text
                                    x={pt.x}
                                    y={pt.y - 10}
                                    textAnchor="middle"
                                    className="text-[11px] font-bold fill-blue-600"
                                  >
                                    {pt.val}
                                  </text>
                                )}
                                <text
                                  x={pt.x}
                                  y="285"
                                  textAnchor="middle"
                                  className="text-[10px] fill-slate-400 font-medium"
                                >
                                  {pt.label}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="text-center text-[11px] font-semibold text-slate-400 pt-2">
                    Waktu (X)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: MANAJEMEN AKUN PENGGUNA & ROLE (SCREENSHOT 2 EXACT REPLICA)  */}
          {/* =================================================================== */}
          {activeNav === "USERS" && isSuper && (
            <div className="space-y-6">
              {/* Header Card Banner with Blue Action Button (Screenshot 2) */}
              <div className="bg-gradient-to-r from-[#172554] via-[#1e293b] to-[#0f172a] text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl border border-slate-700/50">
                <div className="space-y-1.5 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-extrabold text-blue-300 uppercase tracking-widest">
                    <Shield className="w-3.5 h-3.5" />
                    <span>HAK AKSES PENGGUNA</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Manajemen Akun Pengguna &amp; Role
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Kelola hak akses pengguna internal PPI. Atur No. WhatsApp, Angkatan, dan password akun pengguna.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  className="shrink-0 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pengguna Baru</span>
                </button>
              </div>

              {/* 4 KPI Cards (Screenshot 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* Total User Terdaftar */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total User Terdaftar
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {accounts.length}
                    </span>
                    <span className="text-[10px] text-slate-400">Pengguna Internal</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                {/* Super Admin / Admin */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Super Admin / Admin
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {totalSuperAdmins}
                    </span>
                    <span className="text-[10px] text-slate-400">Akses Administrator</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <Shield className="w-6 h-6" />
                  </div>
                </div>

                {/* Anggota Staf */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Anggota Staf
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {totalStaffUsers}
                    </span>
                    <span className="text-[10px] text-slate-400">Akses Terbatas Staf</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <BadgeCheck className="w-6 h-6" />
                  </div>
                </div>

                {/* Status Akun Aktif */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Status Akun Aktif
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {accounts.length}/{accounts.length}
                    </span>
                    <span className="text-[10px] text-slate-400">Dapat Mengakses Panel</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Data Table Card (Screenshot 2 Exact Table Style) */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Daftar Akun Pengguna &amp; Hak Akses Portal
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Cari user / telepon..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">
                      Total: {filteredAccounts.length} Akun
                    </span>
                  </div>
                </div>

                {/* Responsive Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-3">Nama &amp; Profil User</th>
                        <th className="py-3 px-3">Username Login</th>
                        <th className="py-3 px-3">Email Administrator</th>
                        <th className="py-3 px-3">No. WhatsApp</th>
                        <th className="py-3 px-3">Angkatan</th>
                        <th className="py-3 px-3">Role / Hak Akses</th>
                        <th className="py-3 px-3">Status Akun</th>
                        <th className="py-3 px-3 text-center">Manajemen Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAccounts.map((acc) => {
                        const initials = acc.fullName
                          ? acc.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()
                          : acc.username.slice(0, 2).toUpperCase();

                        const isMaster =
                          acc.username.toLowerCase() === "aditya" ||
                          acc.username.toLowerCase() === "superadmin";

                        return (
                          <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                            {/* Nama & Profil User */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 shadow-xs ${
                                    acc.role === "SUPER_ADMIN"
                                      ? "bg-amber-500 text-slate-950"
                                      : acc.role === "ADMIN"
                                      ? "bg-blue-600 text-white"
                                      : "bg-emerald-600 text-white"
                                  }`}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block text-xs">
                                    {acc.fullName || acc.username}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    User ID: #{acc.id.slice(0, 6)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Username Login */}
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] font-semibold">
                                {acc.username}
                              </span>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-3">
                              <span className="text-slate-600 font-mono text-[11px]">
                                {acc.email || "—"}
                              </span>
                            </td>

                            {/* No WhatsApp */}
                            <td className="py-3.5 px-3">
                              {acc.phone ? (
                                <a
                                  href={`https://wa.me/${acc.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-semibold"
                                >
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  <span>{acc.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Angkatan */}
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[10px]">
                                {acc.angkatan || "2025"}
                              </span>
                            </td>

                            {/* Role / Hak Akses */}
                            <td className="py-3.5 px-3">
                              {isMaster ? (
                                <span className="inline-block px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-xs">
                                  Super Admin Utama (Master)
                                </span>
                              ) : acc.role === "SUPER_ADMIN" ? (
                                <span className="inline-block px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-bold text-[10px] uppercase">
                                  Super Admin
                                </span>
                              ) : acc.role === "ADMIN" ? (
                                <span className="inline-block px-2.5 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-800 font-bold text-[10px] uppercase">
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[10px] uppercase">
                                  Anggota Staf
                                </span>
                              )}
                            </td>

                            {/* Status Akun */}
                            <td className="py-3.5 px-3">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Aktif</span>
                              </span>
                            </td>

                            {/* Manajemen Aksi */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingAccount(acc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition border border-blue-200"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>

                                {acc.id !== user.userId && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] transition border border-red-200"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: MANAJEMEN ROADSHOW & BARCODE QR                              */}
          {/* =================================================================== */}
          {activeNav === "ROADSHOW" && canRoadshow && (
            <div className="space-y-6">
              {/* Card Kunci Sekolah Hari Ini */}
              <div className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      Atur Sekolah Dikunjungi Hari Ini (Kunci Data Hari Sebelumnya)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                    Petugas Input BB &amp; TB hanya akan mengakses sekolah yang Anda aktifkan hari ini. Data sekolah lain otomatis terkunci demi integritas data seleksi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={todaySchoolId}
                    onChange={async (e) => {
                      const nextId = e.target.value;
                      if (!nextId) return;
                      setTodaySchoolId(nextId);
                      await fetch("/api/roadshow", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "set_active_school_today",
                          schoolId: nextId,
                        }),
                      });
                      loadAll();
                    }}
                    className="px-4 py-2.5 rounded-xl border border-emerald-300 text-xs font-bold text-emerald-800 bg-emerald-50 focus:outline-none"
                  >
                    {roadshowSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSekolah} {s.statusPenilaian === "Hari Ini" ? "(★ Aktif Hari Ini)" : "(🔒 Terkunci)"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        roadshowSchools.find((s) => s.id === todaySchoolId) || roadshowSchools[0];
                      if (current) setQrModalSchool(current);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Tampilkan QR Barcode Panitia</span>
                  </button>
                </div>
              </div>

              {/* Tabel Daftar Sekolah Roadshow */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Daftar Sekolah &amp; Status Roadshow Kabupaten Probolinggo
                  </h3>
                  <span className="text-xs text-slate-500">
                    {roadshowSchools.length} Sekolah Terdaftar
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roadshowSchools.map((school) => (
                    <div
                      key={school.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition shadow-xs flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-xs font-bold text-slate-900 block">
                          {school.namaSekolah}
                        </strong>
                        <span className="text-[11px] text-slate-500 block">
                          Kecamatan: {school.lokasi || "Probolinggo"}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px] mt-1">
                          {school.passedCount || 0} Kandidat Lolos
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setQrModalSchool(school)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                        <span>QR</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 4: OFFICIAL MERCHANDISE                                         */}
          {/* =================================================================== */}
          {activeNav === "MERCH" && canMerch && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Tambah Produk */}
              <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs h-fit">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Tambah Produk Merchandise
                  </h3>
                </div>

                <form onSubmit={(e) => handleAddItem(e, "MERCHANDISE")} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nama Produk Atribut
                    </label>
                    <input
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="Contoh: Kaos Polo Resmi PPI"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Harga (Rupiah)
                    </label>
                    <input
                      type="text"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="Contoh: 125.000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Deskripsi Bahan &amp; Keterangan
                    </label>
                    <textarea
                      rows={2}
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      placeholder="Bahan lacoste cotton premium bordir lambang garuda..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Upload Foto Produk
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e)}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                    />
                    {itemImage && (
                      <img
                        src={itemImage}
                        alt="Preview"
                        className="w-20 h-20 object-contain mt-2 bg-slate-50 rounded-xl p-1 border border-slate-200"
                      />
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingImg}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-500/20 active:scale-98"
                  >
                    {uploadingImg ? "Mengunggah..." : "+ Simpan Produk"}
                  </button>
                </form>
              </div>

              {/* Daftar Produk */}
              <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Daftar Koleksi Atribut Resmi PPI
                  </h3>
                  <span className="text-xs text-slate-500">
                    {merchItems.length} Produk
                  </span>
                </div>

                <div className="space-y-3">
                  {merchItems.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={m.imageUrl || "/polo.png"}
                          alt={m.title}
                          className="w-16 h-16 object-contain bg-white rounded-xl p-1 border border-slate-200 shrink-0"
                        />
                        <div>
                          <strong className="text-xs font-bold text-slate-900 block">
                            {m.title}
                          </strong>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {m.description || "Atribut Resmi PPI"}
                          </p>
                          <span className="text-xs font-bold text-emerald-600">
                            Rp {m.price}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(m.id, m.title)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition"
                      >
                        Hapus Item
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: ALBUM GALERI DOKUMENTASI                                     */}
          {/* =================================================================== */}
          {activeNav === "GALLERY" && canLanding && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Upload Foto */}
              <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs h-fit">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Upload Foto Dokumentasi Baru
                  </h3>
                </div>

                <form onSubmit={(e) => handleAddItem(e, "ROADSHOW_GALLERY")} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nama Kegiatan / Asal Sekolah
                    </label>
                    <input
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="Contoh: Roadshow SMAN 1 PAITON"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Kecamatan"
                      value={itemLocation}
                      onChange={(e) => setItemLocation(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Hari"
                      value={itemDay}
                      onChange={(e) => setItemDay(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Tanggal"
                      value={itemDate}
                      onChange={(e) => setItemDate(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      File Foto Dokumentasi
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e)}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                    />
                    {itemImage && (
                      <img
                        src={itemImage}
                        alt="Preview"
                        className="w-full h-28 object-cover mt-2 rounded-xl border border-slate-200"
                      />
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingImg}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-500/20 active:scale-98"
                  >
                    Simpan Foto Dokumentasi
                  </button>
                </form>
              </div>

              {/* Grid Foto Dokumentasi */}
              <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Galeri Foto Dokumentasi Kegiatan
                  </h3>
                  <span className="text-xs text-slate-500">
                    {galleryItems.length} Foto
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {galleryItems.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={g.imageUrl || "/sman1paiton.jpeg"}
                          alt={g.title}
                          className="w-16 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
                        />
                        <div>
                          <strong className="text-xs font-bold text-slate-900 block">
                            {g.title}
                          </strong>
                          <span className="text-[11px] text-slate-400 block">
                            {g.metaDate || "Jan 2026"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(g.id, g.title)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 6: KELOLA HALAMAN WEB & TOMBOL HERO                             */}
          {/* =================================================================== */}
          {activeNav === "LANDING" && canLanding && (
            <div className="space-y-6">
              {config && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Teks Utama Halaman Beranda (Landing Page)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Judul Hero Utama
                      </label>
                      <input
                        type="text"
                        value={config.heroTitle}
                        onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nomor WA Khusus Pemesanan Merchandise
                      </label>
                      <input
                        type="text"
                        value={config.waAdminMerch}
                        onChange={(e) => setConfig({ ...config, waAdminMerch: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Deskripsi Singkat Hero
                      </label>
                      <textarea
                        rows={2}
                        value={config.heroSubtitle}
                        onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await fetch("/api/landing", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "config", ...config }),
                      });
                      alert("Teks utama berhasil disimpan.");
                      loadAll();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-500/20"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 7: ULASAN & TESTIMONI                                           */}
          {/* =================================================================== */}
          {activeNav === "REVIEWS" && canReviews && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Daftar Ulasan &amp; Testimoni Publik
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {reviews.length} Ulasan
                </span>
              </div>

              <div className="space-y-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-xs font-bold text-slate-900">{r.nama}</strong>
                        {r.kategori === "ppi" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            {r.angkatan && r.angkatan !== "-"
                              ? (String(r.angkatan).toLowerCase().startsWith("ppi")
                                  ? String(r.angkatan).toUpperCase()
                                  : `PPI-${r.angkatan}`)
                              : "PPI"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                            Umum
                          </span>
                        )}
                        <span className="text-xs text-amber-500 font-bold">★ {r.rating}/5</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">&ldquo;{r.pesan}&rdquo;</p>
                    </div>

                    <button
                      onClick={async () => {
                        await fetch(`/api/landing?type=review&id=${r.id}`, { method: "DELETE" });
                        loadAll();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 8: PENGATURAN UMUM & BUKU PANDUAN                                */}
          {/* =================================================================== */}
          {(activeNav === "SETTINGS" || activeNav === "GUIDE") && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {activeNav === "SETTINGS" ? "Pengaturan Website & Domain" : "Buku Panduan Petugas Lapangan"}
                </h3>
              </div>

              {activeNav === "SETTINGS" ? (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>
                    🌐 <strong>Domain Resmi:</strong> <code>https://ppikabupatenprobolinggo.id</code> (Aktif via Vercel).
                  </p>
                  <p>
                    🔒 <strong>Protokol Keamanan:</strong> SSL/TLS Grade A+, Proteksi HMAC SHA-256 pada QR Barcode Penugasan.
                  </p>
                  <p>
                    📞 <strong>Nomor WhatsApp Resmi Helpdesk:</strong> <code>0851-7687-1609</code>.
                  </p>
                  <p>
                    🛍️ <strong>Nomor WhatsApp Store Merchandise:</strong> <code>0822-2836-8042</code>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p>
                    1. <strong>Tugas Pos Input BB:</strong> Masuk ke pos roadshow dan masukkan data Berat Badan (kg) peserta secara teliti.
                  </p>
                  <p>
                    2. <strong>Tugas Pos Input TB:</strong> Masukkan data Tinggi Badan (cm) peserta sesuai standar meteran ukur resmi.
                  </p>
                  <p>
                    3. <strong>Kamera Scanner QR:</strong> Arahkan kamera ke QR Barcode resmi yang ditampilkan di layar Super Admin hari ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: TAMBAH PENGGUNA BARU (SCREENSHOT 2 MODAL)                    */}
      {/* ===================================================================== */}
      {showAddUserModal && (
        <div
          onClick={() => setShowAddUserModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Tambah Akun Pengguna &amp; Hak Akses
                </h3>
                <p className="text-xs text-slate-500">
                  Daftarkan admin divisi atau panitia lapangan PPI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Lengkap Petugas
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Contoh: Aditya Pratama"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Username Login
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={newUsername}
                    onChange={(e) =>
                      setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, "_").slice(0, 20))
                    }
                    placeholder="aditya"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    PPI Angkatan
                  </label>
                  <input
                    type="text"
                    required
                    value={newAngkatan}
                    onChange={(e) => setNewAngkatan(e.target.value)}
                    placeholder="2025"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    No. WhatsApp Aktif
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                    placeholder="081234567890"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Email Administrator
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="aditya@ppikabprobolinggo.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Password Akun
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ketik password aman..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Role / Tingkat Akses
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="USER">Anggota Staf / Panitia Lapangan</option>
                  <option value="ADMIN">Admin Divisi (Akses Menu)</option>
                  <option value="SUPER_ADMIN">Super Admin (Akses Penuh)</option>
                </select>
              </div>

              {newRole !== "SUPER_ADMIN" && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-700 text-[11px]">
                    Hak Akses / Tugas Khusus:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {[
                      { key: "inputBB", label: "Pos Input BB (Berat Badan)" },
                      { key: "inputTB", label: "Pos Input TB (Tinggi Badan)" },
                      { key: "inputRegistrasi", label: "Pos Registrasi Peserta" },
                      { key: "manageRoadshow", label: "Kelola Roadshow Sekolah" },
                      { key: "manageMerchandise", label: "Kelola Merchandise" },
                      { key: "manageLanding", label: "Kelola Landing Page" },
                      { key: "manageReviews", label: "Moderasi Ulasan" },
                    ].map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean((newPerms as any)[p.key])}
                          onChange={(e) =>
                            setNewPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))
                          }
                          className="rounded text-blue-600"
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  Simpan Akun Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: EDIT ROLE & PERMISSIONS AKUN                                 */}
      {/* ===================================================================== */}
      {editingAccount && (
        <div
          onClick={() => setEditingAccount(null)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Hak Akses — {editingAccount.fullName}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  @{editingAccount.username}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Ubah Role
                </label>
                <select
                  value={editingAccount.role}
                  onChange={(e) =>
                    handleChangeAccountRole(editingAccount, e.target.value as any)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="USER">USER (Anggota Staf / Panitia Lapangan)</option>
                  <option value="ADMIN">ADMIN (Admin Divisi)</option>
                  <option value="SUPER_ADMIN">SUPER ADMIN (Akses Penuh)</option>
                </select>
              </div>

              {editingAccount.role !== "SUPER_ADMIN" && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="font-bold text-slate-700 text-[11px]">
                    Toggle Izin Tugas Khusus:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { key: "inputBB", label: "Pos Input BB (Berat Badan)" },
                      { key: "inputTB", label: "Pos Input TB (Tinggi Badan)" },
                      { key: "inputRegistrasi", label: "Pos Registrasi Peserta" },
                      { key: "manageRoadshow", label: "Kelola Roadshow Sekolah" },
                      { key: "manageMerchandise", label: "Kelola Merchandise" },
                      { key: "manageLanding", label: "Kelola Landing Page" },
                      { key: "manageReviews", label: "Moderasi Ulasan" },
                    ].map((p) => {
                      const active = Boolean(editingAccount.permissions?.[p.key as keyof RolePermissions]);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() =>
                            handleToggleAccountPermission(editingAccount, p.key as keyof RolePermissions)
                          }
                          className={`w-full px-3 py-2 rounded-xl text-left font-semibold text-xs flex items-center justify-between border transition ${
                            active
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-500"
                          }`}
                        >
                          <span>{p.label}</span>
                          <span>{active ? "✓ Aktif" : "+ Berikan"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Selesai Edit
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: QR CODE RESMI SUPER ADMIN (ROADSHOW SCANNER)                */}
      {/* ===================================================================== */}
      {qrModalSchool && (
        <div
          onClick={() => setQrModalSchool(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase">
              QR Barcode Panitia PPI
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {qrModalSchool.namaSekolah}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Arahkan scanner kamera panitia ke QR Code ini untuk mulai input data.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mx-auto shadow-inner">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR ${qrModalSchool.namaSekolah}`}
                  className="w-60 h-60 object-contain mx-auto"
                />
              ) : (
                <div className="w-60 h-60 flex items-center justify-center text-slate-400 text-xs">
                  Membuat Barcode...
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              🔒 Terenkripsi HMAC-SHA256 resmi Kabupaten Probolinggo.
            </p>

            <button
              type="button"
              onClick={() => setQrModalSchool(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase"
            >
              Tutup QR Barcode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
