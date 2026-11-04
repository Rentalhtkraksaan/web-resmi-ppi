"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import jsQR from "jsqr";
import PaskibrakaAuthSplit from "@/components/PaskibrakaAuthSplit";

interface RoadshowSchool {
  id: string;
  namaSekolah: string;
  lokasi: string;
  tanggal: string;
  statusPenilaian: string;
  qrPayload?: string;
  _count?: { candidates: number };
}

interface RoadshowCandidate {
  id: string;
  kodePeserta: string;
  nama: string;
  jenisKelamin: "Cewek" | "Cowok";
  schoolId: string;
  beratBadan: number;
  tinggiBadan: number;
  hasilLulus: boolean;
  statusTayang: boolean;
  keterangan: string;
  updatedBy: string;
}

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  angkatan: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
}

export default function PpiRoadshow27Page() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Mode: LOGIN vs REGISTER (Daftar Panitia)
  const authMode = "LOGIN";

  // Roadshow State
  const [schools, setSchools] = useState<RoadshowSchool[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string>("");
  const [candidates, setCandidates] = useState<RoadshowCandidate[]>([]);
  const [isAdminRoadshow, setIsAdminRoadshow] = useState(false);
  const [qrVerified, setQrVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Active Filter Tab inside unlocked workspace: ALL_TABLES (BB & TB) | REGISTRASI | ADMIN_PANEL
  const [activeTab, setActiveTab] = useState<"ALL_TABLES" | "REGISTRASI" | "ADMIN_PANEL">("ALL_TABLES");

  // Super Admin QR Modal State
  const [qrModalSchool, setQrModalSchool] = useState<RoadshowSchool | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Panitia Auto-Camera QR Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [qrVerifying, setQrVerifying] = useState(false);

  // Add School Form (Super Admin)
  const [newSchoolName, setNewSchoolName] = useState("");

  // Register Candidate Form
  const [regNama, setRegNama] = useState("");
  const [regGender, setRegGender] = useState<"Cowok" | "Cewek">("Cowok");
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  // Real-time Save Status Map
  const [saveIndicators, setSaveIndicators] = useState<Record<string, string>>({});

  // Logout Modal with 5-Second Skip Countdown (Rating NOT Mandatory after 5s)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(5);
  const [logoutRating, setLogoutRating] = useState(5);
  const [logoutPesan, setLogoutPesan] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);

  const loadRoadshowData = async (targetSchoolId?: string, isInitial = false) => {
    try {
      const authRes = await fetch("/api/auth", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData.authenticated || !authData.user) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setUser(authData.user);
      const sid = targetSchoolId !== undefined ? targetSchoolId : activeSchoolId;
      const q = sid ? `&schoolId=${encodeURIComponent(sid)}` : "";
      const rsRes = await fetch(`/api/roadshow?mode=internal${q}`, { cache: "no-store" });
      if (rsRes.ok) {
        const rsData = await rsRes.json();
        setSchools(rsData.schools || []);
        if (!sid && rsData.activeSchoolId) {
          setActiveSchoolId(rsData.activeSchoolId);
        }
        setCandidates(rsData.candidates || []);
        const adminAccess = Boolean(rsData.access?.isAdminRoadshow);
        setIsAdminRoadshow(adminAccess);
        setQrVerified(Boolean(rsData.qrVerified));

        if (isInitial) {
          setActiveTab(adminAccess ? "ADMIN_PANEL" : "ALL_TABLES");
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadRoadshowData(undefined, true);
  }, []);

  // Real-time synchronization interval (updates BB, TB, and candidate status live across devices)
  useEffect(() => {
    if (!user || !qrVerified || !activeSchoolId) return;
    const timer = setInterval(() => {
      loadRoadshowData(activeSchoolId, false);
    }, 2500);
    return () => clearInterval(timer);
  }, [user, qrVerified, activeSchoolId]);

  // Generate QR Code DataURL whenever Super Admin opens QR Modal for a school
  useEffect(() => {
    if (!qrModalSchool?.qrPayload) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(qrModalSchool.qrPayload, {
      width: 340,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [qrModalSchool]);

  // 5-Second Countdown Timer when Logout Modal is opened
  useEffect(() => {
    if (!logoutModalOpen) return;
    setLogoutCountdown(5);
    const interval = setInterval(() => {
      setLogoutCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [logoutModalOpen]);

  // AUTO-START CAMERA FOR PANITIA WHEN LOGGED IN & NOT YET QR-VERIFIED!
  useEffect(() => {
    if (!user || isAdminRoadshow || qrVerified) {
      stopCameraStream();
      return;
    }

    let stream: MediaStream | null = null;
    let scanTimer: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError(
            "Browser ini tidak mendukung akses kamera langsung. Gunakan tombol 'Scan dari Foto / Galeri QR' di bawah."
          );
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraActive(true);
        }

        // Scan video frames every 220ms using jsQR
        scanTimer = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            verifyScannedQrCode(code.data);
          }
        }, 220);
      } catch {
        setCameraError(
          "Kamera belum diizinkan atau tidak tersedia di perangkat ini. Klik 'Izinkan Kamera' di browser atau pilih gambar QR Super Admin di bawah."
        );
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (scanTimer) clearInterval(scanTimer);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setCameraActive(false);
    };
  }, [user, isAdminRoadshow, qrVerified]);

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const verifyScannedQrCode = async (rawQrData: string) => {
    if (qrVerifying || !rawQrData) return;
    setQrVerifying(true);
    setQrScanError(null);
    try {
      const res = await fetch("/api/roadshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_school_qr",
          qrData: rawQrData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQrScanError(
          data.error ||
            "AKSES DIBLOKIR! Barcode/QR yang di-scan BUKAN berasal dari QR Resmi Super Admin PPI!"
        );
      } else {
        stopCameraStream();
        setQrVerified(true);
        setActiveSchoolId(data.school.id);
        await loadRoadshowData(data.school.id, true);
      }
    } finally {
      setTimeout(() => {
        setQrVerifying(false);
      }, 1200);
    }
  };

  const handleScanFromImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (!code || !code.data) {
          setQrScanError("Tidak ditemukan QR Code pada gambar tersebut.");
          return;
        }
        verifyScannedQrCode(code.data);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogoutClick = async () => {
    if (!user) return;
    if (user.role === "USER") {
      setLogoutModalOpen(true);
      return;
    }
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
  };

  const executeLogout = async (withReview: boolean) => {
    if (withReview) {
      if (logoutPesan.trim().length > 50) {
        alert("Isi penilaian maksimal 50 huruf/karakter.");
        return;
      }
      if (/\.php/i.test(logoutPesan)) {
        alert("Isi penilaian tidak boleh mengandung file .php!");
        return;
      }
    }
    setLogoutBusy(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "logout",
          rating: withReview ? logoutRating : undefined,
          pesan: withReview ? logoutPesan : "",
          skipReview: !withReview,
        }),
      });
      stopCameraStream();
      setLogoutModalOpen(false);
      setLogoutPesan("");
      setUser(null);
      setQrVerified(false);

      if (withReview) {
        alert("Terima kasih! Penilaian & ulasan Anda berhasil disimpan.");
        window.location.href = "/#penilaian-preview";
      } else {
        window.location.href = "/login";
      }
    } finally {
      setLogoutBusy(false);
    }
  };

  const switchSchool = async (schoolId: string) => {
    setActiveSchoolId(schoolId);
    await loadRoadshowData(schoolId, false);
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    const res = await fetch("/api/roadshow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_school",
        namaSekolah: newSchoolName.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Gagal menambah sekolah");
      return;
    }
    setNewSchoolName("");
    await switchSchool(data.school.id);
    // Automatically show the QR Code modal so Super Admin can immediately let Panitia scan it!
    setQrModalSchool(data.school);
  };

  const handleSetTodaySchool = async (school: RoadshowSchool) => {
    const res = await fetch("/api/roadshow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_active_school_today",
        schoolId: school.id,
      }),
    });
    if (res.ok) {
      setActiveSchoolId(school.id);
      await loadRoadshowData(school.id, false);
    }
  };

  const handleDeleteSchool = async (school: RoadshowSchool) => {
    if (!confirm(`Hapus sekolah "${school.namaSekolah}" beserta datanya?`)) return;
    const res = await fetch(`/api/roadshow?type=school&id=${school.id}`, { method: "DELETE" });
    if (res.ok) loadRoadshowData("");
  };

  const handleRegisterCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchoolId || !regNama.trim()) return;
    const res = await fetch("/api/roadshow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register_candidate",
        schoolId: activeSchoolId,
        nama: regNama.trim(),
        jenisKelamin: regGender,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Gagal mendaftarkan peserta");
      return;
    }
    setRegNama("");
    setLastCreatedCode(data.candidate.kodePeserta);
    loadRoadshowData(activeSchoolId);
  };

  const handleSaveBbTb = async (candidateId: string, field: "beratBadan" | "tinggiBadan", value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const key = `${candidateId}_${field}`;
    setSaveIndicators((prev) => ({ ...prev, [key]: "Menyimpan..." }));

    const res = await fetch("/api/roadshow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_bb_tb",
        candidateId,
        [field]: num,
      }),
    });

    if (res.ok) {
      setSaveIndicators((prev) => ({ ...prev, [key]: "✓ Tersimpan" }));
      setTimeout(() => {
        setSaveIndicators((prev) => ({ ...prev, [key]: "" }));
      }, 1800);
      loadRoadshowData(activeSchoolId);
    } else {
      const errData = await res.json().catch(() => ({}));
      setSaveIndicators((prev) => ({ ...prev, [key]: errData.error || "Gagal" }));
    }
  };

  const handleAdminCandidateUpdate = async (
    candidateId: string,
    updates: Partial<Pick<RoadshowCandidate, "hasilLulus" | "statusTayang" | "keterangan">>
  ) => {
    const res = await fetch("/api/roadshow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admin_update_candidate",
        candidateId,
        ...updates,
      }),
    });
    if (res.ok) loadRoadshowData(activeSchoolId);
  };

  const handleBulkPublishSchool = async (statusTayang: boolean) => {
    if (!activeSchoolId) return;
    const res = await fetch("/api/roadshow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_tayang_school",
        schoolId: activeSchoolId,
        statusTayang,
      }),
    });
    if (res.ok) loadRoadshowData(activeSchoolId);
  };

  const handleDeleteCandidate = async (id: string, nama: string) => {
    if (!confirm(`Hapus peserta "${nama}"?`)) return;
    const res = await fetch(`/api/roadshow?type=candidate&id=${id}`, { method: "DELETE" });
    if (res.ok) loadRoadshowData(activeSchoolId);
  };

  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || c.nama.toLowerCase().includes(q) || c.kodePeserta.toLowerCase().includes(q);
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-zinc-400 text-sm">
        Memuat...
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: LOGIN & DAFTAR PANITIA (ALA DISHUB DENGAN TEMA RESMI PASKIBRAKA)
  // =========================================================================
  if (!user) {
    return (
      <PaskibrakaAuthSplit
        initialMode={authMode}
        onSuccess={() => loadRoadshowData(undefined, true)}
      />
    );
  }

  // =========================================================================
  // VIEW 2: PANITIA WAJIB SCAN QR CODE SUPER ADMIN (AUTO-CAMERA ON!)
  // =========================================================================
  if (!isAdminRoadshow && !qrVerified) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 px-4 sm:px-8 py-3.5 bg-[#0a0a0c]">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-white truncate">
                Verifikasi QR Super Admin
              </h1>
              <p className="text-[11px] text-zinc-400 truncate">
                Panitia: <strong className="text-zinc-200">{user.fullName}</strong> (PPI Akt. {user.angkatan})
              </p>
            </div>
            <button
              onClick={handleLogoutClick}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-red-400 hover:bg-zinc-800 shrink-0"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Kamera Aktif Otomatis
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-white">
                Scan QR Code dari Super Admin
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Arahkan kamera ke <strong>QR Code Sekolah</strong> yang ditampilkan di layar Super Admin untuk membuka form Registrasi, Tabel BB, dan Tabel TB.
              </p>
            </div>

            {/* Security Block Alert if scanning non-Super-Admin QR */}
            {qrScanError && (
              <div className="p-3.5 rounded-xl bg-red-600/20 border-2 border-red-500 text-red-200 text-xs font-bold leading-relaxed animate-pulse">
                ⛔ {qrScanError}
              </div>
            )}

            {/* Live Camera Viewport */}
            <div className="relative w-full aspect-square max-w-[290px] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-red-500/60 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning Frame Overlay */}
              <div className="absolute inset-6 border-2 border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-red-500" />
                  <span className="w-4 h-4 border-t-2 border-r-2 border-red-500" />
                </div>
                <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_#ef4444] animate-pulse" />
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-red-500" />
                  <span className="w-4 h-4 border-b-2 border-r-2 border-red-500" />
                </div>
              </div>

              {!cameraActive && !cameraError && (
                <span className="absolute text-xs text-zinc-400">Menyalakan kamera...</span>
              )}
            </div>

            {cameraError && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                {cameraError}
              </p>
            )}

            {/* Fallback: Scan directly via Camera Capture / Gallery Image */}
            <div className="pt-1">
              <label className="cursor-pointer inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition">
                📷 Ambil Foto / Pilih Gambar QR Super Admin
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleScanFromImageFile}
                  className="hidden"
                />
              </label>
            </div>

            <p className="text-[11px] text-zinc-500">
              🔒 Sistem proteksi aktif: Barcode atau QR Code selain milik Super Admin PPI akan otomatis ditolak &amp; diblokir.
            </p>
          </div>
        </main>

        {/* Logout Modal with 5-Star Rating & 5-Second Skip Countdown */}
        {logoutModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Konfirmasi Logout &amp; Penilaian
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Beri rating &amp; ulasan singkat (opsional) atau tunggu 5 detik untuk logout tanpa rating.
                </p>
              </div>

              {/* BINTANG & RATING DI ATAS SESUAI REQUEST */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setLogoutRating(s)}
                      className="text-2xl sm:text-3xl focus:outline-none transition-transform hover:scale-110 active:scale-95"
                      title={`${s} Bintang`}
                    >
                      <span className={s <= logoutRating ? "text-amber-400" : "text-zinc-700"}>
                        ★
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">Ulasan Singkat (Opsional, Maks. 50 huruf)</span>
                    <span className="text-[11px] text-zinc-500">{logoutPesan.length}/50</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={50}
                    value={logoutPesan}
                    onChange={(e) => setLogoutPesan(e.target.value.slice(0, 50))}
                    placeholder="Tulis kesan/masukan jika ingin memberi ulasan..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    disabled={logoutBusy}
                    onClick={() => executeLogout(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30"
                  >
                    ★ Kirim Rating &amp; Logout
                  </button>

                  <button
                    type="button"
                    disabled={logoutCountdown > 0 || logoutBusy}
                    onClick={() => executeLogout(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-bold transition"
                  >
                    {logoutCountdown > 0
                      ? `Tunggu ${logoutCountdown} dtk...`
                      : "Logout Tanpa Rating"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogoutModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: WORKSPACE ROADSHOW (100% RESPONSIVE DI HP & LAPTOP!)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100">
      {/* RESPONSIVE HEADER */}
      <header className="sticky top-0 z-30 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase">
                {user.role === "SUPER_ADMIN"
                  ? "SUPER ADMIN"
                  : isAdminRoadshow
                  ? "ADMIN ROADSHOW"
                  : "PANITIA TERVERIFIKASI QR"}
              </span>
              <h1 className="font-bold text-sm sm:text-base text-white truncate">
                {activeSchool?.namaSekolah || "Pilih Sekolah"}
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              {user.fullName} (PPI Akt. {user.angkatan}) • Sinkronisasi Real-Time
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/roadshow"
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Hasil Publik
            </Link>
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/dashboard"
                className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Dashboard
              </Link>
            )}
            <button
              onClick={handleLogoutClick}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-7 space-y-5">
        {/* SUPER ADMIN SCHOOL MANAGEMENT + QR CODE GENERATOR */}
        {isAdminRoadshow ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Kelola Sekolah &amp; QR Code Super Admin
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Buat sekolah baru atau klik <strong>&ldquo;Buka QR Panitia&rdquo;</strong> agar panitia dapat men-scan barcode sekolah hari ini.
                </p>
              </div>

              <form onSubmit={handleCreateSchool} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="Nama sekolah baru..."
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:border-red-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold whitespace-nowrap"
                >
                  + Buat Sekolah &amp; QR Baru
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {schools.map((s) => {
                const active = s.id === activeSchoolId;
                const isToday = s.statusPenilaian === "Hari Ini";
                return (
                  <div
                    key={s.id}
                    onClick={() => switchSchool(s.id)}
                    className={`cursor-pointer px-3 py-2 rounded-xl border text-xs font-semibold transition flex flex-wrap items-center gap-2 ${
                      active
                        ? "bg-red-600 text-white border-red-600"
                        : isToday
                        ? "bg-emerald-950/60 text-emerald-200 border-emerald-500/60"
                        : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <span>{s.namaSekolah}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        active ? "bg-black/30 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {s._count?.candidates ?? 0}
                    </span>

                    {isToday && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase">
                        ★ Aktif Hari Ini
                      </span>
                    )}

                    {active && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!isToday && (
                          <button
                            type="button"
                            onClick={() => handleSetTodaySchool(s)}
                            className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px]"
                          >
                            Aktifkan Hari Ini
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQrModalSchool(s)}
                          className="px-2 py-0.5 rounded bg-white text-black font-bold text-[10px]"
                        >
                          📱 Buka QR Panitia
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchool(s)}
                          className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 text-[10px]"
                          title="Hapus Sekolah"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* BANNER SEKOLAH AKTIF UNTUK PANITIA YANG SUDAH SCAN QR */
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Terhubung via QR Super Admin
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                {activeSchool?.namaSekolah}
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400">
              Total Peserta: <strong className="text-white">{candidates.length}</strong>
            </span>
          </div>
        )}

        {/* NAVIGATION & SEARCH BAR (RESPONSIVE) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("ALL_TABLES")}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                activeTab === "ALL_TABLES"
                  ? "bg-sky-500 text-black border-sky-500"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              Tabel Input BB &amp; TB
            </button>

            <button
              onClick={() => setActiveTab("REGISTRASI")}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                activeTab === "REGISTRASI"
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              + Registrasi Nama Peserta
            </button>

            {isAdminRoadshow && (
              <button
                onClick={() => setActiveTab("ADMIN_PANEL")}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                  activeTab === "ADMIN_PANEL"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                Panel Kelulusan &amp; Tayang
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              maxLength={100}
              value={searchQuery.slice(0, 100)}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text") || "";
                if ((searchQuery.length + pasted.length) > 100) {
                  e.preventDefault();
                  const remaining = 100 - searchQuery.length;
                  if (remaining > 0) {
                    setSearchQuery((prev) => (prev + pasted.slice(0, remaining)).slice(0, 100));
                  }
                }
              }}
              placeholder="Cari nama atau kode peserta (maks. 100)..."
              className="w-full pl-3.5 pr-14 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:border-red-500 focus:outline-none"
            />
            {searchQuery.length > 0 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono">
                {searchQuery.length}/100
              </span>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: DUA TABEL SEKALIGUS (TABEL BB & TABEL TB) - BEBAS ISI & RAPI */}
        {/* =================================================================== */}
        {activeTab === "ALL_TABLES" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* TABEL 1: INPUT BERAT BADAN (BB) */}
            <div className="bg-zinc-900 border border-sky-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 overflow-hidden">
              <div className="border-b border-zinc-800 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Tabel 1 • Real-Time Sync
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Input Berat Badan (BB) — {activeSchool?.namaSekolah}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Ketik angka BB (kg) lalu tekan Tab / klik luar untuk simpan otomatis.
                </p>
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredCandidates.length === 0 ? (
                  <p className="text-zinc-500 text-xs py-8 text-center">
                    Belum ada peserta di sekolah ini.
                  </p>
                ) : (
                  filteredCandidates.map((c, idx) => (
                    <div
                      key={`bb_row_${c.id}`}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-zinc-500 font-mono">#{idx + 1}</span>
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                            {c.kodePeserta}
                          </span>
                          <span className="text-[11px] text-zinc-400">({c.jenisKelamin})</span>
                        </div>
                        <div className="font-bold text-white text-xs sm:text-sm mt-1 break-words leading-snug">
                          {c.nama}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end">
                        <div className="flex items-center bg-zinc-900 border border-zinc-700 focus-within:border-sky-400 rounded-lg px-2 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            key={`bb_${c.id}_${c.beratBadan}`}
                            defaultValue={c.beratBadan || ""}
                            placeholder="0"
                            onBlur={(e) => handleSaveBbTb(c.id, "beratBadan", e.target.value)}
                            className="w-14 sm:w-16 bg-transparent text-white text-center font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[11px] font-semibold text-zinc-400 pl-1">
                            kg
                          </span>
                        </div>
                        {saveIndicators[`${c.id}_beratBadan`] && (
                          <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                            {saveIndicators[`${c.id}_beratBadan`]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TABEL 2: INPUT TINGGI BADAN (TB) */}
            <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 overflow-hidden">
              <div className="border-b border-zinc-800 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Tabel 2 • Real-Time Sync
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Input Tinggi Badan (TB) — {activeSchool?.namaSekolah}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Ketik angka TB (cm) lalu tekan Tab / klik luar untuk simpan otomatis.
                </p>
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredCandidates.length === 0 ? (
                  <p className="text-zinc-500 text-xs py-8 text-center">
                    Belum ada peserta di sekolah ini.
                  </p>
                ) : (
                  filteredCandidates.map((c, idx) => (
                    <div
                      key={`tb_row_${c.id}`}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-zinc-500 font-mono">#{idx + 1}</span>
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                            {c.kodePeserta}
                          </span>
                          <span className="text-[11px] text-zinc-400">({c.jenisKelamin})</span>
                        </div>
                        <div className="font-bold text-white text-xs sm:text-sm mt-1 break-words leading-snug">
                          {c.nama}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end">
                        <div className="flex items-center bg-zinc-900 border border-zinc-700 focus-within:border-amber-400 rounded-lg px-2 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            key={`tb_${c.id}_${c.tinggiBadan}`}
                            defaultValue={c.tinggiBadan || ""}
                            placeholder="0"
                            onBlur={(e) => handleSaveBbTb(c.id, "tinggiBadan", e.target.value)}
                            className="w-14 sm:w-16 bg-transparent text-white text-center font-bold text-xs sm:text-sm focus:outline-none"
                          />
                          <span className="text-[11px] font-semibold text-zinc-400 pl-1">
                            cm
                          </span>
                        </div>
                        {saveIndicators[`${c.id}_tinggiBadan`] && (
                          <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                            {saveIndicators[`${c.id}_tinggiBadan`]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: REGISTRASI NAMA PESERTA                                      */}
        {/* =================================================================== */}
        {activeTab === "REGISTRASI" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 h-fit">
              <h3 className="text-sm sm:text-base font-bold text-white">
                Registrasi Peserta Baru — {activeSchool?.namaSekolah}
              </h3>
              <form onSubmit={handleRegisterCandidate} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Nama Lengkap Peserta
                  </label>
                  <input
                    type="text"
                    required
                    value={regNama}
                    onChange={(e) => setRegNama(e.target.value)}
                    placeholder="Masukkan nama lengkap peserta"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value as "Cowok" | "Cewek")}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="Cowok">Laki-laki (Putra)</option>
                    <option value="Cewek">Perempuan (Putri)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs uppercase tracking-wider"
                >
                  Daftarkan Peserta
                </button>
              </form>

              {lastCreatedCode && (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                  <span className="text-xs text-emerald-300 block">Kode Peserta:</span>
                  <strong className="text-2xl font-mono font-bold text-white">{lastCreatedCode}</strong>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider mb-3">
                Daftar Peserta Terdaftar ({filteredCandidates.length})
              </h3>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase sticky top-0">
                    <tr>
                      <th className="p-3">No</th>
                      <th className="p-3">Kode</th>
                      <th className="p-3">Nama Peserta</th>
                      <th className="p-3">JK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredCandidates.map((c, i) => (
                      <tr key={c.id}>
                        <td className="p-3 text-zinc-500">{i + 1}</td>
                        <td className="p-3 font-mono font-bold text-sky-400">{c.kodePeserta}</td>
                        <td className="p-3 font-semibold text-white">{c.nama}</td>
                        <td className="p-3 text-zinc-400">{c.jenisKelamin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: PANEL ADMIN ROADSHOW (TAYANGKAN SEMUA & HIDE 1 PER 1)        */}
        {/* =================================================================== */}
        {activeTab === "ADMIN_PANEL" && isAdminRoadshow && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Kelola Kelulusan &amp; Tayang Publik — {activeSchool?.namaSekolah}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Anda dapat menayangkan semua sekaligus atau menyembunyikan (hide) satu per satu peserta yang lolos.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeSchool && (
                  <button
                    onClick={() => setQrModalSchool(activeSchool)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition"
                  >
                    📱 Tampilkan QR Sekolah Ini
                  </button>
                )}
                <button
                  onClick={() => handleBulkPublishSchool(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                >
                  Tayangkan Semua Sekaligus
                </button>
                <button
                  onClick={() => handleBulkPublishSchool(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition"
                >
                  Sembunyikan (Hide) Semua
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Kode</th>
                    <th className="p-3">Nama Peserta</th>
                    <th className="p-3">BB / TB</th>
                    <th className="p-3">Status Kelulusan</th>
                    <th className="p-3">Tampil di /roadshow (Hide 1-1)</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredCandidates.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-950/60">
                      <td className="p-3 font-mono font-bold text-sky-400">{c.kodePeserta}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{c.nama}</div>
                        <div className="text-[11px] text-zinc-500">{c.jenisKelamin}</div>
                      </td>
                      <td className="p-3 font-mono text-zinc-300 whitespace-nowrap">
                        {c.beratBadan || 0} kg / {c.tinggiBadan || 0} cm
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleAdminCandidateUpdate(c.id, { hasilLulus: true })}
                            className={`px-2.5 py-1.5 rounded-lg font-bold transition ${
                              c.hasilLulus
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            Lulus
                          </button>
                          <button
                            onClick={() => handleAdminCandidateUpdate(c.id, { hasilLulus: false })}
                            className={`px-2.5 py-1.5 rounded-lg font-bold transition ${
                              !c.hasilLulus
                                ? "bg-red-600 text-white"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            Tidak
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() =>
                            handleAdminCandidateUpdate(c.id, { statusTayang: !c.statusTayang })
                          }
                          className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                            c.statusTayang
                              ? "bg-sky-500/20 border border-sky-500/40 text-sky-300"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {c.statusTayang ? "Ditayangkan (Klik Hide)" : "Hidden"}
                        </button>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          defaultValue={c.keterangan || ""}
                          placeholder="Catatan..."
                          onBlur={(e) =>
                            handleAdminCandidateUpdate(c.id, { keterangan: e.target.value })
                          }
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white w-36"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteCandidate(c.id, c.nama)}
                          className="px-2.5 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/30 font-semibold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* MODAL QR CODE RESMI SUPER ADMIN (UNTUK DI-SCAN OLEH KAMERA PANITIA)   */}
      {/* ===================================================================== */}
      {qrModalSchool && (
        <div
          onClick={() => setQrModalSchool(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase">
              QR Resmi Super Admin PPI
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">
                {qrModalSchool.namaSekolah}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Minta seluruh panitia login dan arahkan kamera mereka ke QR Code ini.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-lg">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR ${qrModalSchool.namaSekolah}`}
                  className="w-64 h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-zinc-500 text-xs">
                  Membuat QR...
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              🔒 Terenkripsi HMAC-SHA256. Kamera panitia otomatis memblokir QR lain selain QR ini.
            </p>

            <button
              type="button"
              onClick={() => setQrModalSchool(null)}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider"
            >
              Tutup QR
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL LOGOUT DENGAN HITUNG MUNDUR 5 DETIK (TANPA WAJIB RATING)        */}
      {/* ===================================================================== */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Selesai Bertugas &amp; Logout
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Berikan ulasan singkat (opsional) atau tunggu 5 detik untuk langsung logout tanpa rating.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setLogoutRating(s)}
                    className="text-2xl focus:outline-none"
                  >
                    <span className={s <= logoutRating ? "text-amber-400" : "text-zinc-700"}>
                      ★
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">Ulasan Singkat (Opsional, Maks. 50 huruf)</span>
                  <span className="text-[11px] text-zinc-500">{logoutPesan.length}/50</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={50}
                  value={logoutPesan}
                  onChange={(e) => setLogoutPesan(e.target.value.slice(0, 50))}
                  placeholder="Tulis kesan/evaluasi jika ingin memberi ulasan..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  disabled={logoutBusy}
                  onClick={() => executeLogout(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30"
                >
                  ★ Kirim Rating &amp; Logout
                </button>

                <button
                  type="button"
                  disabled={logoutCountdown > 0 || logoutBusy}
                  onClick={() => executeLogout(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-bold transition"
                >
                  {logoutCountdown > 0
                    ? `Logout Tanpa Rating (${logoutCountdown} dtk)`
                    : "Logout Tanpa Rating"}
                </button>

                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
