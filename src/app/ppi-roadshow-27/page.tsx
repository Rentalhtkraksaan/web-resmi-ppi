"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/useLive";
import Link from "next/link";
import QRCode from "qrcode";
import jsQR from "jsqr";
import PaskibrakaAuthSplit from "@/components/PaskibrakaAuthSplit";
import { showConfirm, showError, showSuccess, showWarning } from "@/lib/swal";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle,
  Edit,
  FileText,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  X,
  Upload,
} from "lucide-react";

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

interface RoadshowPost {
  id: string;
  title: string;
  category: string;
  status: "SUDAH_DIKUNJUNGI" | "AKAN_DIKUNJUNGI";
  schoolId?: string;
  schoolName: string;
  location: string;
  date: string;
  imageUrl: string;
  summary: string;
  content: string;
  sortOrder: number;
  isPublished: boolean;
  author: string;
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

  // Active Filter Tab: TABEL_BB (Tabel BB) | TABEL_TB (Tabel TB) | REGISTRASI | ADMIN_PANEL | POSTS_PANEL
  const [activeTab, setActiveTab] = useState<"TABEL_BB" | "TABEL_TB" | "REGISTRASI" | "ADMIN_PANEL" | "POSTS_PANEL">("TABEL_BB");

  // Candidate Edit Modal State (Panitia User & Admin)
  const [editingCandidate, setEditingCandidate] = useState<RoadshowCandidate | null>(null);
  const [editCandidateNama, setEditCandidateNama] = useState("");
  const [editCandidateGender, setEditCandidateGender] = useState<"Cowok" | "Cewek">("Cowok");
  const [editCandidateBB, setEditCandidateBB] = useState("");
  const [editCandidateTB, setEditCandidateTB] = useState("");
  const [editCandidateKet, setEditCandidateKet] = useState("");
  const [savingCandidateBusy, setSavingCandidateBusy] = useState(false);

  // Manual QR input fallback
  const [showManualQrInput, setShowManualQrInput] = useState(false);
  const [manualQrText, setManualQrText] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");

  // Roadshow Posts (Berita & Agenda Kunjungan) State
  const [posts, setPosts] = useState<RoadshowPost[]>([]);
  const [postsFilter, setPostsFilter] = useState<"ALL" | "SUDAH_DIKUNJUNGI" | "AKAN_DIKUNJUNGI">("ALL");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<RoadshowPost | null>(null);
  const [postFormTitle, setPostFormTitle] = useState("");
  const [postFormStatus, setPostFormStatus] = useState<"SUDAH_DIKUNJUNGI" | "AKAN_DIKUNJUNGI">("SUDAH_DIKUNJUNGI");
  const [postFormCategory, setPostFormCategory] = useState("Kunjungan Selesai");
  const [postFormSchool, setPostFormSchool] = useState("");
  const [postFormLocation, setPostFormLocation] = useState("");
  const [postFormDate, setPostFormDate] = useState("");
  const [postFormImage, setPostFormImage] = useState("");
  const [postFormSummary, setPostFormSummary] = useState("");
  const [postFormContent, setPostFormContent] = useState("");
  const [postFormSaving, setPostFormSaving] = useState(false);
  const [uploadingPostImg, setUploadingPostImg] = useState(false);

  // Super Admin QR Modal State
  const [qrModalSchool, setQrModalSchool] = useState<RoadshowSchool | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Panitia Auto-Camera QR Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      const isManagerUser =
        authData.user.role === "SUPER_ADMIN" ||
        authData.user.role === "ADMIN" ||
        Boolean(authData.user.permissions?.manageRoadshow);

      const sid = targetSchoolId !== undefined ? targetSchoolId : activeSchoolId;
      const q = sid ? `&schoolId=${encodeURIComponent(sid)}` : "";
      const rsRes = await fetch(`/api/roadshow?mode=internal${q}`, { cache: "no-store" });
      if (rsRes.ok) {
        const rsData = await rsRes.json();
        const adminAccess = Boolean(rsData.access?.isAdminRoadshow) || isManagerUser;
        setIsAdminRoadshow(adminAccess);
        const verified = Boolean(rsData.qrVerified) || adminAccess;
        setQrVerified(verified);

        if (!verified && !adminAccess) {
          // Panitia otomatis kepental dari sekolah yang ditutup / QR mati
          setActiveSchoolId("");
          setCandidates([]);
          setSchools([]);
        } else {
          setSchools(rsData.schools || []);
          if (!sid && rsData.activeSchoolId) {
            setActiveSchoolId(rsData.activeSchoolId);
          }
          setCandidates(rsData.candidates || []);
        }

        if (isInitial) {
          setActiveTab(adminAccess ? "ADMIN_PANEL" : "TABEL_BB");
        }
      } else if (rsRes.status === 403 && !isManagerUser) {
        setQrVerified(false);
        setActiveSchoolId("");
        setCandidates([]);
        setSchools([]);
      }

      // Load Roadshow Posts
      try {
        const postsRes = await fetch("/api/roadshow?mode=posts", { cache: "no-store" });
        if (postsRes.ok) {
          const pData = await postsRes.json();
          setPosts(pData.posts || []);
        }
      } catch { }
    } finally {
      setAuthLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const postsRes = await fetch("/api/roadshow?mode=posts", { cache: "no-store" });
      if (postsRes.ok) {
        const pData = await postsRes.json();
        setPosts(pData.posts || []);
      }
    } catch { }
  };

  const openCreatePostModal = () => {
    setEditingPost(null);
    setPostFormTitle("");
    setPostFormStatus("SUDAH_DIKUNJUNGI");
    setPostFormCategory("Kunjungan Selesai");
    setPostFormSchool(activeSchool?.namaSekolah || "");
    setPostFormLocation(activeSchool?.lokasi || "Kabupaten Probolinggo");
    setPostFormDate(
      new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase()
    );
    setPostFormImage("");
    setPostFormSummary("");
    setPostFormContent("");
    setPostModalOpen(true);
  };

  const openEditPostModal = (p: RoadshowPost) => {
    setEditingPost(p);
    setPostFormTitle(p.title);
    setPostFormStatus(p.status);
    setPostFormCategory(p.category);
    setPostFormSchool(p.schoolName);
    setPostFormLocation(p.location);
    setPostFormDate(p.date);
    setPostFormImage(p.imageUrl);
    setPostFormSummary(p.summary);
    setPostFormContent(p.content);
    setPostModalOpen(true);
  };

  const handleUploadPostPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showWarning("Ukuran File Terlalu Besar", "Maksimal ukuran foto adalah 5 MB.");
      return;
    }
    setUploadingPostImg(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setPostFormImage(data.url);
        showSuccess("Foto Terunggah", "Foto berita berhasil diunggah.");
      } else {
        showError("Gagal Upload", data.error || "Gagal mengunggah foto.");
      }
    } catch {
      showError("Gangguan Jaringan", "Gagal mengunggah foto.");
    } finally {
      setUploadingPostImg(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postFormTitle.trim()) {
      showWarning("Judul Wajib Diisi", "Silakan masukkan judul berita.");
      return;
    }
    setPostFormSaving(true);
    try {
      const isEdit = Boolean(editingPost);
      const res = await fetch("/api/roadshow", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isEdit ? "update_post" : "create_post",
          id: editingPost?.id,
          title: postFormTitle.trim(),
          status: postFormStatus,
          category: postFormCategory,
          schoolName: postFormSchool.trim(),
          location: postFormLocation.trim(),
          date: postFormDate.trim(),
          imageUrl: postFormStatus === "SUDAH_DIKUNJUNGI" ? postFormImage.trim() : "",
          summary: postFormSummary.trim(),
          content: postFormContent.trim(),
          isPublished: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError("Gagal Menyimpan", data.error || "Gagal menyimpan berita.");
        return;
      }
      setPostModalOpen(false);
      showSuccess(
        "Berita Tersimpan",
        `Berita "${postFormTitle}" berhasil ${isEdit ? "diperbarui" : "diterbitkan"}!`
      );
      loadPosts();
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
    } finally {
      setPostFormSaving(false);
    }
  };

  const handleTogglePostStatus = async (p: RoadshowPost) => {
    const nextStatus = p.status === "SUDAH_DIKUNJUNGI" ? "AKAN_DIKUNJUNGI" : "SUDAH_DIKUNJUNGI";
    const statusLabel = nextStatus === "SUDAH_DIKUNJUNGI" ? "Sudah Dikunjungi" : "Akan Dikunjungi";
    const confirmRes = await showConfirm(
      "Ubah Status Kunjungan",
      `Ubah status "${p.title}" menjadi "${statusLabel}"?`
    );
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch("/api/roadshow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_post",
          id: p.id,
          status: nextStatus,
          title: p.title,
          category: p.category,
          schoolName: p.schoolName,
          location: p.location,
          date: p.date,
          imageUrl: nextStatus === "AKAN_DIKUNJUNGI" ? "" : p.imageUrl,
          summary: p.summary,
          content: p.content,
          isPublished: p.isPublished,
        }),
      });
      if (res.ok) {
        showSuccess("Status Diperbarui", `Status berita diubah menjadi "${statusLabel}".`);
        loadPosts();
      } else {
        showError("Gagal", "Gagal memperbarui status berita.");
      }
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
    }
  };

  const handleDeletePost = async (p: RoadshowPost) => {
    const confirmRes = await showConfirm(
      "Hapus Berita Roadshow",
      `Hapus berita "${p.title}" secara permanen?`
    );
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/roadshow?type=post&id=${p.id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess("Berita Dihapus", "Berita berhasil dihapus.");
        setPosts((prev) => prev.filter((x) => x.id !== p.id));
      } else {
        showError("Gagal", "Gagal menghapus berita.");
      }
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
    }
  };

  useEffect(() => {
    loadRoadshowData(undefined, true);
  }, []);

  // Real-time synchronization (BB, TB, peserta, sekolah, berita) ~1,5 detik, lintas perangkat
  useLive(
    () => loadRoadshowData(activeSchoolId, false),
    1500,
    Boolean(user) && qrVerified && Boolean(activeSchoolId)
  );

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

  // Robust Camera Scanner Functions
  const stopCameraStream = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setCameraError(null);
    setQrScanError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "Browser ini tidak mendukung akses kamera langsung. Silakan gunakan opsi 'Ambil Foto QR' atau ketik kode manual di bawah."
        );
        return;
      }

      stopCameraStream();

      const constraintsList: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: facing }, audio: false },
        { video: { facingMode: facing === "environment" ? "user" : "environment" }, audio: false },
        { video: true, audio: false },
      ];

      let streamAcquired: MediaStream | null = null;
      for (const constraints of constraintsList) {
        try {
          streamAcquired = await navigator.mediaDevices.getUserMedia(constraints);
          if (streamAcquired) break;
        } catch {
          // try next constraint
        }
      }

      if (!streamAcquired) {
        setCameraError(
          "Kamera belum diizinkan atau sedang digunakan oleh aplikasi lain. Klik 'Buka Kamera' atau izinkan akses kamera pada browser."
        );
        return;
      }

      streamRef.current = streamAcquired;
      if (videoRef.current) {
        videoRef.current.srcObject = streamAcquired;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }

      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      scanTimerRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
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
      }, 180);
    } catch {
      setCameraError(
        "Kamera belum diizinkan atau tidak dapat diakses. Silakan izinkan akses kamera pada browser atau pilih foto QR di bawah."
      );
    }
  };

  const toggleFacingMode = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // AUTO-START CAMERA FOR PANITIA WHEN LOGGED IN & NOT YET QR-VERIFIED!
  useEffect(() => {
    if (!user || isAdminRoadshow || qrVerified) {
      stopCameraStream();
      return;
    }

    startCamera("environment");

    return () => {
      stopCameraStream();
    };
  }, [user, isAdminRoadshow, qrVerified]);

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
        showSuccess("QR Terverifikasi!", `Akses ke formulir ${data.school.namaSekolah} berhasil dibuka.`);
        await loadRoadshowData(data.school.id, true);
      }
    } catch {
      setQrScanError("Gagal menghubungi server verifikasi QR.");
    } finally {
      setTimeout(() => {
        setQrVerifying(false);
      }, 1000);
    }
  };

  const handleManualQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manualQrText.trim();
    if (!raw) return;
    verifyScannedQrCode(raw);
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
    const confirmRes = await showConfirm(
      "Konfirmasi Logout",
      "Apakah Anda yakin ingin keluar dari sistem Roadshow?"
    );
    if (!confirmRes.isConfirmed) return;

    stopCameraStream();
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      // offline fallback
    }
    setUser(null);
    setQrVerified(false);
    window.location.href = "/login";
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
      if (res.status === 403 && !isAdminRoadshow) {
        setQrVerified(false);
        setActiveSchoolId("");
        setCandidates([]);
      }
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
      setSaveIndicators((prev) => ({ ...prev, [key]: "Tersimpan" }));
      setTimeout(() => {
        setSaveIndicators((prev) => ({ ...prev, [key]: "" }));
      }, 1800);
      loadRoadshowData(activeSchoolId);
    } else {
      const errData = await res.json().catch(() => ({}));
      setSaveIndicators((prev) => ({ ...prev, [key]: errData.error || "Gagal" }));
      if (res.status === 403 && !isAdminRoadshow) {
        alert(errData.error || "Sesi roadshow untuk sekolah ini telah ditutup/selesai. Silakan scan ulang QR sekolah yang aktif.");
        setQrVerified(false);
        setActiveSchoolId("");
        setCandidates([]);
      }
    }
  };

  const openEditCandidateModal = (c: RoadshowCandidate) => {
    setEditingCandidate(c);
    setEditCandidateNama(c.nama);
    setEditCandidateGender(c.jenisKelamin === "Cewek" ? "Cewek" : "Cowok");
    setEditCandidateBB(c.beratBadan ? String(c.beratBadan) : "");
    setEditCandidateTB(c.tinggiBadan ? String(c.tinggiBadan) : "");
    setEditCandidateKet(c.keterangan || "");
  };

  const handleSaveCandidateEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;
    setSavingCandidateBusy(true);
    try {
      const res = await fetch("/api/roadshow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_candidate",
          candidateId: editingCandidate.id,
          nama: editCandidateNama.trim(),
          jenisKelamin: editCandidateGender,
          beratBadan: editCandidateBB ? Number(editCandidateBB) : 0,
          tinggiBadan: editCandidateTB ? Number(editCandidateTB) : 0,
          keterangan: editCandidateKet.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError("Gagal Mengubah Data", data.error || "Gagal menyimpan perubahan.");
        return;
      }
      showSuccess("Data Disimpan", `Data peserta "${editCandidateNama}" berhasil diperbarui.`);
      setEditingCandidate(null);
      await loadRoadshowData(activeSchoolId, false);
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
    } finally {
      setSavingCandidateBusy(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string, nama: string) => {
    const confirmRes = await showConfirm(
      "Hapus Peserta",
      `Hapus peserta "${nama}" secara permanen dari sistem?`
    );
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/roadshow?type=candidate&id=${candidateId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Peserta Dihapus", `Peserta "${nama}" berhasil dihapus.`);
        if (editingCandidate?.id === candidateId) setEditingCandidate(null);
        await loadRoadshowData(activeSchoolId, false);
      } else {
        const d = await res.json();
        showError("Gagal", d.error || "Gagal menghapus peserta.");
      }
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
    }
  };

  const handleToggleSchoolStatus = async (school: RoadshowSchool) => {
    const nextStatus = school.statusPenilaian === "Hari Ini" ? "Ditutup" : "Hari Ini";
    try {
      const res = await fetch("/api/roadshow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_school_status",
          schoolId: school.id,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        showSuccess(
          "Status Diperbarui",
          `Sekolah "${school.namaSekolah}" sekarang ${nextStatus === "Hari Ini" ? "Aktif Hari Ini" : "Ditutup / Terkunci"}.`
        );
        await loadRoadshowData(activeSchoolId, false);
      } else {
        const d = await res.json();
        showError("Gagal", d.error || "Gagal mengubah status sekolah.");
      }
    } catch {
      showError("Gangguan Jaringan", "Gagal menghubungi server.");
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

  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  const isManager = isAdminRoadshow || user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
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
  if (!isManager && !qrVerified) {
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
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard"
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Dashboard</span>
              </Link>
              <button
                onClick={handleLogoutClick}
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-xs font-semibold text-red-400 hover:text-red-300 transition"
              >
                Logout
              </button>
            </div>
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
              <div className="p-3.5 rounded-xl bg-red-600/20 border-2 border-red-500 text-red-200 text-xs font-bold leading-relaxed flex items-center gap-2 text-left animate-pulse">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                <span>{qrScanError}</span>
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
              <div className="space-y-2">
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-center gap-2 text-left">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{cameraError}</span>
                </p>
              </div>
            )}

            {/* Kontrol kamera: nyalakan manual + ganti depan/belakang */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => startCamera(cameraFacing)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs text-white font-bold transition"
              >
                <Camera className="w-3.5 h-3.5" /> {cameraActive ? "Mulai Ulang" : "Nyalakan Kamera"}
              </button>
              <button
                type="button"
                onClick={toggleFacingMode}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 border border-zinc-700 font-semibold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {cameraFacing === "environment" ? "Kamera Depan" : "Kamera Belakang"}
              </button>
            </div>

            {/* Fallback: Scan directly via Camera Capture / Gallery Image */}
            <div className="pt-1">
              <label className="cursor-pointer inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition gap-2">
                <Camera className="w-4 h-4 text-zinc-300" />
                <span>Ambil Foto / Pilih Gambar QR Super Admin</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleScanFromImageFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Fallback terakhir: tempel isi QR secara manual */}
            <div className="text-left">
              <button
                type="button"
                onClick={() => setShowManualQrInput((v) => !v)}
                className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
              >
                {showManualQrInput ? "Tutup input manual" : "Kamera tidak bisa? Masukkan kode QR secara manual"}
              </button>
              {showManualQrInput && (
                <form onSubmit={handleManualQrSubmit} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={manualQrText}
                    onChange={(e) => setManualQrText(e.target.value)}
                    placeholder="Tempel isi QR sekolah..."
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:border-red-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                  >
                    Buka
                  </button>
                </form>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Sistem proteksi aktif: Barcode atau QR Code selain milik Super Admin PPI akan otomatis ditolak &amp; diblokir.</span>
            </p>
          </div>
        </main>
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
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard</span>
            </Link>
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
        {isManager ? (
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
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Sekolah &amp; QR Baru</span>
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
                    className={`cursor-pointer px-3 py-2 rounded-xl border text-xs font-semibold transition flex flex-wrap items-center gap-2 ${active
                        ? "bg-red-600 text-white border-red-600"
                        : isToday
                          ? "bg-emerald-950/60 text-emerald-200 border-emerald-500/60"
                          : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                      }`}
                  >
                    <span>{s.namaSekolah}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${active ? "bg-black/30 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}
                    >
                      {s._count?.candidates ?? 0}
                    </span>

                    {isToday && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aktif Hari Ini
                      </span>
                    )}

                    {active && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSchoolStatus(s)}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            isToday
                              ? "bg-black/30 hover:bg-black/50 text-amber-200"
                              : "bg-emerald-500 hover:bg-emerald-400 text-black"
                          }`}
                        >
                          {isToday ? "Matikan" : "Aktifkan Hari Ini"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrModalSchool(s)}
                          className="px-2 py-0.5 rounded bg-white text-black font-bold text-[10px] inline-flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" /> Buka QR Panitia
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchool(s)}
                          className="p-1 rounded bg-black/30 hover:bg-black/50 text-red-300 text-[10px]"
                          title="Hapus Sekolah"
                        >
                          <Trash2 className="w-3 h-3" />
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
              onClick={() => setActiveTab("TABEL_BB")}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${activeTab === "TABEL_BB"
                  ? "bg-sky-500 text-black border-sky-500"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                }`}
            >
              Tabel BB
            </button>

            <button
              onClick={() => setActiveTab("TABEL_TB")}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${activeTab === "TABEL_TB"
                  ? "bg-amber-500 text-black border-amber-500"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                }`}
            >
              Tabel TB
            </button>

            <button
              onClick={() => setActiveTab("REGISTRASI")}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition inline-flex items-center gap-1.5 ${activeTab === "REGISTRASI"
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrasi Peserta</span>
            </button>

            {isAdminRoadshow && (
              <button
                onClick={() => setActiveTab("ADMIN_PANEL")}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${activeTab === "ADMIN_PANEL"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                  }`}
              >
                Panel Kelulusan &amp; Tayang
              </button>
            )}

            {isAdminRoadshow && (
              <button
                onClick={() => {
                  setActiveTab("POSTS_PANEL");
                  loadPosts();
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${activeTab === "POSTS_PANEL"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Kelola Berita Roadshow ({posts.length})</span>
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
        {/* TAB: TABEL BB & TABEL TB (TERPISAH, MASING-MASING FULL TABLE)        */}
        {/* =================================================================== */}
        {(activeTab === "TABEL_BB" || activeTab === "TABEL_TB") &&
          (() => {
            const isBB = activeTab === "TABEL_BB";
            const field = isBB ? "beratBadan" : "tinggiBadan";
            const unit = isBB ? "kg" : "cm";
            const accent = isBB ? "text-sky-400 bg-sky-500/15" : "text-amber-400 bg-amber-500/15";
            return (
              <div
                className={`bg-zinc-900 border rounded-2xl p-4 sm:p-5 space-y-4 ${
                  isBB ? "border-sky-500/30" : "border-amber-500/30"
                }`}
              >
                <div className="border-b border-zinc-800 pb-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isBB ? "text-sky-400" : "text-amber-400"
                    }`}
                  >
                    {isBB ? "Tabel 1" : "Tabel 2"} • Sinkron Real-Time
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {isBB ? "Input Berat Badan (BB)" : "Input Tinggi Badan (TB)"} — {activeSchool?.namaSekolah}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Ketik angka {isBB ? "BB (kg)" : "TB (cm)"} lalu tekan Tab / klik di luar kolom untuk menyimpan otomatis. Salah ketik nama? Klik tombol Edit.
                  </p>
                </div>

                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950 text-zinc-400 uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-12">No</th>
                        <th className="p-3">Kode</th>
                        <th className="p-3">Nama Peserta</th>
                        <th className="p-3">JK</th>
                        <th className="p-3">{isBB ? "Berat Badan" : "Tinggi Badan"}</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredCandidates.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-500">
                            Belum ada peserta di sekolah ini.
                          </td>
                        </tr>
                      ) : (
                        filteredCandidates.map((c, idx) => (
                          <tr key={`${field}_row_${c.id}`} className="hover:bg-zinc-950/60">
                            <td className="p-3 text-zinc-500">{idx + 1}</td>
                            <td className="p-3">
                              <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${accent}`}>
                                {c.kodePeserta}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-white break-words">{c.nama}</td>
                            <td className="p-3 text-zinc-400">{c.jenisKelamin}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`inline-flex items-center bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 ${
                                    isBB ? "focus-within:border-sky-400" : "focus-within:border-amber-400"
                                  }`}
                                >
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    key={`${field}_${c.id}_${c[field]}`}
                                    defaultValue={c[field] || ""}
                                    placeholder="0"
                                    onBlur={(e) => handleSaveBbTb(c.id, field, e.target.value)}
                                    className="w-16 bg-transparent text-white text-center font-bold text-sm focus:outline-none"
                                  />
                                  <span className="text-[11px] font-semibold text-zinc-400 pl-1">{unit}</span>
                                </div>
                                {saveIndicators[`${c.id}_${field}`] && (
                                  <span className="text-[10px] text-emerald-400 font-semibold">
                                    {saveIndicators[`${c.id}_${field}`]}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => openEditCandidateModal(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold transition"
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

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
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredCandidates.map((c, i) => (
                      <tr key={c.id}>
                        <td className="p-3 text-zinc-500">{i + 1}</td>
                        <td className="p-3 font-mono font-bold text-sky-400">{c.kodePeserta}</td>
                        <td className="p-3 font-semibold text-white">{c.nama}</td>
                        <td className="p-3 text-zinc-400">{c.jenisKelamin}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditCandidateModal(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(c.id, c.nama)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        </td>
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
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition inline-flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Tampilkan QR Sekolah Ini</span>
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
                            className={`px-2.5 py-1.5 rounded-lg font-bold transition ${c.hasilLulus
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                              }`}
                          >
                            Lulus
                          </button>
                          <button
                            onClick={() => handleAdminCandidateUpdate(c.id, { hasilLulus: false })}
                            className={`px-2.5 py-1.5 rounded-lg font-bold transition ${!c.hasilLulus
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
                          className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${c.statusTayang
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

        {/* =================================================================== */}
        {/* TAB 4: KELOLA BERITA & AGENDA KUNJUNGAN ROADSHOW (PENJAB ROADSHOW) */}
        {/* =================================================================== */}
        {activeTab === "POSTS_PANEL" && isAdminRoadshow && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Kelola Berita &amp; Agenda Kunjungan Roadshow
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Atur publikasi berita sekolah yang <strong>Sudah Dikunjungi</strong> atau rilis agenda yang <strong>Akan Dikunjungi</strong> untuk ditampilkan di portal publik.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openCreatePostModal}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/25 flex items-center gap-2"
                >
                  <span>+</span>
                  <span>Tulis Berita / Agenda Baru</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPostsFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${postsFilter === "ALL"
                    ? "bg-white text-black"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
              >
                Semua Berita ({posts.length})
              </button>

              <button
                type="button"
                onClick={() => setPostsFilter("SUDAH_DIKUNJUNGI")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${postsFilter === "SUDAH_DIKUNJUNGI"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-950 text-emerald-400 hover:bg-emerald-950/40 border border-emerald-900/60"
                  }`}
              >
                <Check className="w-3.5 h-3.5 inline mr-0.5" />
                <span>Sudah Dikunjungi</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 font-mono">
                  {posts.filter((p) => p.status === "SUDAH_DIKUNJUNGI").length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPostsFilter("AKAN_DIKUNJUNGI")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${postsFilter === "AKAN_DIKUNJUNGI"
                    ? "bg-sky-600 text-white"
                    : "bg-zinc-950 text-sky-400 hover:bg-sky-950/40 border border-sky-900/60"
                  }`}
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-0.5" />
                <span>Akan Dikunjungi</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 font-mono">
                  {posts.filter((p) => p.status === "AKAN_DIKUNJUNGI").length}
                </span>
              </button>
            </div>

            {/* Posts Grid */}
            {posts.filter((p) => postsFilter === "ALL" || p.status === postsFilter).length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 text-center text-xs text-zinc-500">
                Belum ada berita atau agenda pada filter ini. Klik &quot;+ Tulis Berita / Agenda Baru&quot; untuk menambahkan.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts
                  .filter((p) => postsFilter === "ALL" || p.status === postsFilter)
                  .map((post) => {
                    const isSudah = post.status === "SUDAH_DIKUNJUNGI";
                    return (
                      <div
                        key={post.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
                            <img
                              src={
                                post.imageUrl ||
                                "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1000"
                              }
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                            <span
                              className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isSudah
                                  ? "bg-emerald-600 text-white"
                                  : "bg-sky-600 text-white"
                                }`}
                            >
                              {isSudah ? "Sudah Dikunjungi" : "Akan Dikunjungi"}
                            </span>
                            <span className="absolute bottom-0 left-0 px-3 py-1 bg-black/70 text-zinc-200 text-[10px] font-mono font-bold">
                              {post.date || "AGUSTUS 2026"}
                            </span>
                          </div>

                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="text-emerald-400 font-semibold">{post.category}</span>
                              <span className="truncate max-w-[120px]">{post.location}</span>
                            </div>

                            <h4 className="font-bold text-white text-sm line-clamp-2 leading-snug">
                              {post.title}
                            </h4>

                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                              {post.summary || post.content}
                            </p>

                            <div className="text-[11px] text-zinc-500 pt-1">
                              Sekolah: {post.schoolName || "Sekolah Mitra"}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePostStatus(post)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                            title="Ubah antara Sudah Dikunjungi dan Akan Dikunjungi"
                          >
                            Ganti Status
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditPostModal(post)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/30 text-xs font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 text-xs font-semibold"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
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

            <p className="text-[11px] text-zinc-400 leading-relaxed flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Terenkripsi HMAC-SHA256. Kamera panitia otomatis memblokir QR lain selain QR ini.</span>
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
      {/* MODAL EDIT DATA PESERTA (PANITIA, ADMIN ROADSHOW, SUPER ADMIN)        */}
      {/* ===================================================================== */}
      {editingCandidate && (
        <div
          onClick={() => !savingCandidateBusy && setEditingCandidate(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveCandidateEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                  {editingCandidate.kodePeserta}
                </span>
                <h3 className="text-base font-extrabold text-white mt-1">Edit Data Peserta</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                maxLength={100}
                value={editCandidateNama}
                onChange={(e) => setEditCandidateNama(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Jenis Kelamin</label>
              <select
                value={editCandidateGender}
                onChange={(e) => setEditCandidateGender(e.target.value as "Cowok" | "Cewek")}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-red-500 focus:outline-none"
              >
                <option value="Cowok">Laki-laki (Putra)</option>
                <option value="Cewek">Perempuan (Putri)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Berat Badan (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editCandidateBB}
                  onChange={(e) => setEditCandidateBB(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Tinggi Badan (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editCandidateTB}
                  onChange={(e) => setEditCandidateTB(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Catatan</label>
              <textarea
                rows={2}
                maxLength={300}
                value={editCandidateKet}
                onChange={(e) => setEditCandidateKet(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={savingCandidateBusy}
                onClick={() => handleDeleteCandidate(editingCandidate.id, editingCandidate.nama)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-bold disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Peserta
              </button>
              <button
                type="submit"
                disabled={savingCandidateBusy}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {savingCandidateBusy ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL BUAT / EDIT BERITA &amp; AGENDA KUNJUNGAN ROADSHOW                   */}
      {/* ===================================================================== */}
      {postModalOpen && (
        <div
          onClick={() => !postFormSaving && setPostModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-4 shadow-2xl my-auto text-left"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase">
                  CMS Penjab Roadshow
                </span>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  {editingPost ? "Edit Berita / Agenda Roadshow" : "Tulis Berita / Agenda Kunjungan Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Judul Berita / Rilis Agenda *
                </label>
                <input
                  type="text"
                  required
                  value={postFormTitle}
                  onChange={(e) => setPostFormTitle(e.target.value)}
                  placeholder="Contoh: Sosialisasi Pra-Seleksi Paskibraka di SMKN 1 Kraksaan Rampung"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Status Kunjungan *
                  </label>
                  <select
                    value={postFormStatus}
                    onChange={(e) => setPostFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-bold focus:border-red-500 focus:outline-none"
                  >
                    <option value="SUDAH_DIKUNJUNGI">Sudah Dikunjungi</option>
                    <option value="AKAN_DIKUNJUNGI">Akan Dikunjungi (Jadwal/Agenda)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Kategori / Topik
                  </label>
                  <input
                    type="text"
                    value={postFormCategory}
                    onChange={(e) => setPostFormCategory(e.target.value)}
                    placeholder="Contoh: Kunjungan Selesai, Agenda Resmi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Nama Sekolah
                  </label>
                  <input
                    type="text"
                    value={postFormSchool}
                    onChange={(e) => setPostFormSchool(e.target.value)}
                    placeholder="Contoh: SMKN 1 KRAKSAAN"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Lokasi Kunjungan
                  </label>
                  <input
                    type="text"
                    value={postFormLocation}
                    onChange={(e) => setPostFormLocation(e.target.value)}
                    placeholder="Contoh: Kraksaan, Kab. Probolinggo"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Tanggal Berita / Kunjungan (Persis Tampilan Diskominfo)
                </label>
                <input
                  type="text"
                  value={postFormDate}
                  onChange={(e) => setPostFormDate(e.target.value)}
                  placeholder="Contoh: 04 AGUSTUS 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-red-500 focus:outline-none"
                />
              </div>

              {postFormStatus === "AKAN_DIKUNJUNGI" ? (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-sky-200">
                      Status: Akan Dikunjungi (Agenda Kalender)
                    </span>
                    <p className="text-[11px] text-sky-300/90 leading-relaxed">
                      Sesuai ketentuan, sekolah yang belum dikunjungi tidak memerlukan foto dokumentasi lapangan. Halaman publik akan otomatis menampilkan kartu agenda resmi dengan tanggal kunjungan tanpa foto.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Upload Foto Dokumentasi Lapangan <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPostPhoto}
                      disabled={uploadingPostImg}
                      className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                    />
                    {uploadingPostImg && (
                      <span className="text-[11px] text-amber-400 font-semibold animate-pulse">
                        Mengunggah gambar ke server...
                      </span>
                    )}
                    {postFormImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-zinc-700 max-h-40 bg-black">
                        <img
                          src={postFormImage}
                          alt="Preview Foto Berita"
                          className="w-full h-36 object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-bold">
                            Terpasang
                          </span>
                          <button
                            type="button"
                            onClick={() => setPostFormImage("")}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic">
                        Belum ada foto dokumentasi lapangan. Silakan unggah foto kegiatan.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Ringkasan Berita (Untuk Tampilan Card)
                </label>
                <textarea
                  rows={2}
                  value={postFormSummary}
                  onChange={(e) => setPostFormSummary(e.target.value)}
                  placeholder="Ringkasan singkat 2-3 kalimat mengenai kegiatan ini..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Isi Berita Lengkap
                </label>
                <textarea
                  rows={4}
                  value={postFormContent}
                  onChange={(e) => setPostFormContent(e.target.value)}
                  placeholder="Tuliskan laporan narasi lengkap kegiatan roadshow di sini..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:border-red-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={postFormSaving || uploadingPostImg}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30"
                >
                  {postFormSaving ? "Menyimpan..." : "Simpan & Publikasikan"}
                </button>
                <button
                  type="button"
                  onClick={() => setPostModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
