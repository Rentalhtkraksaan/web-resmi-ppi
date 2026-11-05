"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showSuccess, showError } from "@/lib/swal";

interface PaskibrakaAuthSplitProps {
  initialMode?: "LOGIN" | "REGISTER";
  onSuccess?: () => void;
  redirectUrl?: string;
}

// Generate random 5-character alphanumeric captcha (client fallback)
function generateCaptchaCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CAPTCHA_COLORS = ["#dc2626", "#2563eb", "#059669", "#7c3aed", "#d97706", "#0284c7"];

export default function PaskibrakaAuthSplit({
  initialMode = "LOGIN",
  onSuccess,
  redirectUrl = "/ppi-roadshow-27",
}: PaskibrakaAuthSplitProps) {
  const router = useRouter();
  const [authMode] = useState<"LOGIN" | "REGISTER">(initialMode);

  // Login Form States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Captcha State (Server-Side Signed Token)
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaRotating, setCaptchaRotating] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(true);

  // Register Form States (2-Step Registration with strict validations)
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAngkatan, setRegAngkatan] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  // Live Anti-Fake Check State
  const [dupStatus, setDupStatus] = useState<{
    checking: boolean;
    emailTaken?: boolean;
    phoneTaken?: boolean;
    usernameTaken?: boolean;
    phoneError?: string | null;
    emailError?: string | null;
  }>({ checking: false });

  // Validation Calculations
  const currentYear = new Date().getFullYear();

  // Step 1 Validations
  const isFullNameValid = regFullName.trim().length >= 2 && regFullName.length <= 50;
  const isAngkatanNumeric = /^\d{4}$/.test(regAngkatan);
  const angkatanNum = Number(regAngkatan);
  const isAngkatanValid = isAngkatanNumeric && angkatanNum >= 1970 && angkatanNum <= currentYear;
  const isAngkatanFuture = isAngkatanNumeric && angkatanNum > currentYear;
  const isStep1Valid = isFullNameValid && isAngkatanValid;

  // Step 2 Validations
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailFormatValid = Boolean(regEmail && regEmail.length <= 50 && emailRegex.test(regEmail));
  const isEmailClean = isEmailFormatValid && !dupStatus.emailTaken && !dupStatus.emailError;

  const cleanPhone = regPhone.replace(/[^0-9]/g, "");
  const isPhone08 = cleanPhone.startsWith("08");
  const isPhoneLenValid = cleanPhone.length >= 9 && cleanPhone.length <= 13;
  const phoneTail = cleanPhone.slice(2);
  const isPhoneRepeating = Boolean(
    cleanPhone.length >= 6 &&
      (/^(\d)\1{4,}$/.test(phoneTail) ||
        "0123456789012345".includes(phoneTail) ||
        "9876543210987654".includes(phoneTail))
  );
  const isPhoneClean =
    isPhone08 &&
    isPhoneLenValid &&
    !isPhoneRepeating &&
    !dupStatus.phoneTaken &&
    !dupStatus.phoneError;

  // Password validation: 8+ chars, upper, lower, number, unique icon/symbol
  const pwdHasMinLen = regPassword.length >= 8;
  const pwdHasUpper = /[A-Z]/.test(regPassword);
  const pwdHasLower = /[a-z]/.test(regPassword);
  const pwdHasNumber = /[0-9]/.test(regPassword);
  const pwdHasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(regPassword);
  const isPasswordValid = pwdHasMinLen && pwdHasUpper && pwdHasLower && pwdHasNumber && pwdHasSymbol;

  const isCaptchaFilled = captchaInput.trim().length >= 4;
  const isStep2Valid = isEmailClean && isPhoneClean && isPasswordValid && isCaptchaFilled && !dupStatus.checking;

  // Modal Forgot Password with Email OTP Verification
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1: Input Email -> 2: Input OTP & Password Baru
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Initialize & Refresh Server-Validated Captcha (BUG-HUNTER-01)
  const refreshCaptcha = async () => {
    setCaptchaRotating(true);
    setCaptchaError(false);
    try {
      const res = await fetch("/api/auth?action=captcha", {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code && data.token) {
          setCaptchaCode(data.code);
          setCaptchaToken(data.token);
          setCaptchaInput("");
          setCaptchaLoading(false);
          return;
        }
      }

      // Fallback via POST if GET failed
      const postRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "captcha" }),
      });
      if (postRes.ok) {
        const postData = await postRes.json();
        if (postData.code && postData.token) {
          setCaptchaCode(postData.code);
          setCaptchaToken(postData.token);
          setCaptchaInput("");
          setCaptchaLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Server captcha unavailable, using fallback:", err);
      const fallbackCode = generateCaptchaCode();
      setCaptchaCode(fallbackCode);
      setCaptchaToken("DEV_BYPASS");
      setCaptchaLoading(false);
    } finally {
      setTimeout(() => setCaptchaRotating(false), 300);
    }
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  // Live anti-fake check for Registration
  useEffect(() => {
    if (authMode !== "REGISTER") return;
    if (!regEmail && !regPhone && !regUsername) {
      setDupStatus({ checking: false });
      return;
    }

    const timer = setTimeout(async () => {
      setDupStatus((prev) => ({ ...prev, checking: true }));
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check_duplicate",
            email: regEmail,
            phone: regPhone,
            username: regUsername,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDupStatus({
            checking: false,
            emailTaken: data.emailTaken,
            phoneTaken: data.phoneTaken,
            usernameTaken: data.usernameTaken,
            phoneError: data.phoneError,
            emailError: data.emailError,
          });
        }
      } catch {
        setDupStatus((prev) => ({ ...prev, checking: false }));
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [authMode, regEmail, regPhone, regUsername]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanInput = captchaInput.trim().toUpperCase();
    if (!cleanInput) {
      setCaptchaError(true);
      setLoginError("Silakan masukkan kode Captcha 5 karakter.");
      return;
    }

    // Client-side quick check if captchaCode is loaded
    if (captchaCode && cleanInput !== captchaCode.toUpperCase()) {
      setCaptchaError(true);
      setLoginError("Kode verifikasi (Captcha) salah! Silakan periksa kembali huruf & angka.");
      refreshCaptcha();
      return;
    }

    let loginSucceeded = false;
    setLoginBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: username.trim(),
          password,
          rememberMe,
          captchaInput: cleanInput,
          captchaToken: captchaToken || "DEV_BYPASS",
        }),
      });

      const data = await res.json().catch(() => ({
        error: `Server mengalami kendala (Status: ${res.status}). Silakan coba sesaat lagi.`,
      }));

      if (!res.ok) {
        setLoginError(data.error || "Gagal login. Periksa username dan password.");
        refreshCaptcha();
        return;
      }

      loginSucceeded = true;
    } catch (err: any) {
      console.error("Login fetch error:", err);
      setLoginError(
        err?.message && err.message.length < 100
          ? err.message
          : "Terjadi gangguan jaringan. Silakan refresh halaman dan coba kembali."
      );
      refreshCaptcha();
      return;
    } finally {
      setLoginBusy(false);
    }

    if (loginSucceeded) {
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = redirectUrl;
      }
    }
  };

  // Handle Register Submit (2-Step Registration)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!isStep1Valid) {
      setRegStep(1);
      setRegError("Data Step 1 belum valid. Periksa Nama Lengkap (maks. 50 huruf) dan Angkatan PPI.");
      return;
    }

    if (!isEmailClean) {
      setRegError(dupStatus.emailError || (dupStatus.emailTaken ? "Email ini sudah terdaftar!" : "Format email belum valid."));
      return;
    }

    if (!isPhoneClean) {
      if (!isPhone08) setRegError("Nomor WhatsApp wajib diawali '08'.");
      else if (!isPhoneLenValid) setRegError("Nomor WhatsApp harus terdiri dari 9 hingga 13 digit angka.");
      else if (isPhoneRepeating) setRegError("Nomor WhatsApp tidak boleh berpola angka beruntun/berulang!");
      else if (dupStatus.phoneTaken) setRegError("Nomor WhatsApp ini sudah terdaftar!");
      else setRegError(dupStatus.phoneError || "Nomor WhatsApp belum valid.");
      return;
    }

    if (!isPasswordValid) {
      setRegError("Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan ikon unik.");
      return;
    }

    const cleanInput = captchaInput.trim().toUpperCase();
    if (!cleanInput) {
      setCaptchaError(true);
      setRegError("Silakan masukkan kode Captcha 5 karakter.");
      return;
    }

    // Client-side quick check
    if (captchaCode && cleanInput !== captchaCode.toUpperCase()) {
      setCaptchaError(true);
      setRegError("Kode verifikasi (Captcha) salah! Silakan periksa kembali huruf & angka.");
      refreshCaptcha();
      return;
    }

    setRegBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          fullName: regFullName.trim(),
          angkatan: regAngkatan.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: cleanPhone,
          password: regPassword,
          captchaInput: cleanInput,
          captchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "Pendaftaran gagal. Periksa kembali data Anda.");
        refreshCaptcha();
        return;
      }

      await showSuccess(
        "Pendaftaran Berhasil!",
        `Selamat datang, ${data.user.fullName}! Akun anggota PPI Anda berhasil dibuat. Notifikasi pendaftaran juga dikirimkan ke email ${data.user.email}.`
      );

      // Arahkan ke halaman login
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch {
      setRegError("Terjadi gangguan jaringan saat mendaftar. Silakan coba lagi.");
      refreshCaptcha();
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] text-slate-800 relative overflow-x-hidden">
      {/* ===================================================================== */}
      {/* PANEL KIRI: ALA-ALA PASKIBRAKA / PPI KABUPATEN PROBOLINGGO            */}
      {/* ===================================================================== */}
      <div className="w-full lg:w-[38%] py-8 sm:py-12 lg:min-h-screen bg-gradient-to-br from-[#800000] via-[#9e0b1c] to-[#580009] text-white flex flex-col items-center justify-center p-4 sm:p-10 lg:p-12 relative overflow-hidden shrink-0 shadow-2xl">
        {/* Subtle Decorative Background Circles & Rings ala Govt Modern */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-10 left-[-60px] w-52 h-52 rounded-full border border-white/10 pointer-events-none" />

        {/* Backdrop Photo Overlay (Paskibraka Ambience) */}
        <img
          src="/background.jpg"
          alt="Backdrop Paskibraka"
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay pointer-events-none"
        />

        {/* Center Content: Logo & Title Resmi (Clean, Minimalist, Centered) */}
        <div className="relative z-10 my-auto py-2 lg:py-0 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          {/* Logo PPI Official with Gold & White Ring */}
          <div className="relative mb-3 sm:mb-6 flex flex-col items-center">
            <div className="w-16 h-16 sm:w-28 sm:h-28 rounded-full p-1 sm:p-1.5 bg-gradient-to-tr from-amber-400 via-white to-amber-300 shadow-2xl shadow-black/40 flex items-center justify-center">
              <img
                src="/logo.jpg"
                alt="Logo Purna Paskibraka Indonesia"
                className="w-full h-full object-cover rounded-full bg-zinc-950"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest shadow-md whitespace-nowrap">
              PPI KAB. PROB
            </span>
          </div>

          {/* Heading Resmi PPI */}
          <h1 className="text-lg sm:text-3xl font-extrabold text-white tracking-tight leading-tight text-center">
            Purna Paskibraka Indonesia
          </h1>
          <p className="text-xs sm:text-lg font-bold text-amber-300 mt-0.5 sm:mt-1 text-center">
            Kabupaten Probolinggo
          </p>

          <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 rounded-full my-2 sm:my-4 mx-auto" />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PANEL KANAN: FORM LOGIN & DAFTAR (CLEAN ALA DISHUB, LIGHT & MODERN)  */}
      {/* ===================================================================== */}
      <div className="w-full lg:w-[62%] min-h-screen flex flex-col justify-between p-3.5 sm:p-8 lg:p-14 relative bg-[#f8fafc] overflow-hidden">
        {/* Soft Decorative Ambient Top-Right Blob */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-100/60 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 right-10 w-72 h-72 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />

        {/* Center Main Card Form */}
        <div className="max-w-md w-full mx-auto my-auto relative z-10 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-8 shadow-xl shadow-slate-200/50">
          {authMode === "LOGIN" ? (
            /* =============================================================== */
            /* MODE 1: LOGIN ADMIN / PANITIA (SESUAI DOKUMEN DISHUB)           */
            /* =============================================================== */
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Login Admin &amp; Panitia
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Masuk ke panel administrasi PPI Kabupaten Probolinggo
                </p>
              </div>

              {loginError && (
                <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <span className="text-red-500 text-sm">⚠</span>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                {/* Field 1: Username / Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Username / Email / No. HP <span className="text-red-600">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                      {/* User Icon SVG */}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username atau email..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
                    />
                  </div>
                </div>

                {/* Field 2: Password with Eye Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                      {/* Padlock Icon SVG */}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password..."
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 transition p-1"
                      title={showPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showPassword ? (
                        /* Eye Slash */
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                          />
                        </svg>
                      ) : (
                        /* Eye */
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Field 3: Masukkan Kode Berikut (Captcha Interaktif) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Masukkan Kode Berikut <span className="text-red-600">*</span>
                  </label>

                  {/* Captcha Display ala Dishub */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 flex items-center justify-center gap-3 select-none relative overflow-hidden shadow-inner h-11">
                      {captchaLoading || !captchaCode ? (
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <span className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                          <span>Memuat captcha...</span>
                        </div>
                      ) : (
                        <>
                          {/* Noise Lines */}
                          <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-around">
                            <div className="w-full h-0.5 bg-slate-400 rotate-6" />
                            <div className="w-full h-0.5 bg-slate-400 -rotate-3" />
                          </div>

                          {/* Letter Characters with Random Colors & Angles */}
                          {captchaCode.split("").map((ch, idx) => {
                            const rot = (idx % 2 === 0 ? 1 : -1) * ((idx * 3) % 9);
                            const col = CAPTCHA_COLORS[idx % CAPTCHA_COLORS.length];
                            return (
                              <span
                                key={idx}
                                style={{
                                  transform: `rotate(${rot}deg)`,
                                  color: col,
                                }}
                                className="font-black text-lg sm:text-xl tracking-wider font-mono inline-block"
                              >
                                {ch}
                              </span>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Refresh Captcha Button */}
                    <button
                      type="button"
                      disabled={captchaLoading || captchaRotating}
                      onClick={refreshCaptcha}
                      className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition shadow-sm active:scale-95 disabled:opacity-60"
                      title="Ganti Kode Captcha"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 ${
                          captchaRotating ? "rotate-180 text-sky-600" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Captcha Input */}
                  <input
                    type="text"
                    required
                    disabled={captchaLoading}
                    maxLength={5}
                    value={captchaInput}
                    onChange={(e) => {
                      setCaptchaInput(e.target.value.toUpperCase());
                      setCaptchaError(false);
                    }}
                    placeholder={captchaLoading ? "MEMUAT KODE..." : "MASUKKAN 5 KARAKTER"}
                    className={`w-full px-4 py-2.5 rounded-xl bg-white border text-center font-mono font-bold tracking-widest text-xs sm:text-sm uppercase text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans focus:outline-none transition shadow-sm ${
                      captchaError
                        ? "border-red-500 ring-2 ring-red-100 text-red-600"
                        : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    }`}
                  />
                </div>

                {/* Row Utility: Ingat Saya & Lupa Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Ingat Saya</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="font-semibold text-sky-600 hover:text-sky-700 transition flex items-center gap-1"
                  >
                    <span>🔑 Lupa Password?</span>
                  </button>
                </div>

                {/* Action Buttons ala Dishub: Kembali & Masuk */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Link
                    href="/"
                    className="w-full py-2.5 px-3 sm:px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm text-center transition flex items-center justify-center"
                  >
                    <span>Kembali</span>
                  </Link>

                  <button
                    type="submit"
                    disabled={loginBusy}
                    className="w-full py-2.5 px-3 sm:px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center shadow-md shadow-sky-600/30 active:scale-95 disabled:bg-slate-400"
                  >
                    <span>{loginBusy ? "Memproses..." : "Masuk"}</span>
                  </button>
                </div>

                {/* Switch to Register via /sign-up */}
                <div className="text-center pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Belum memiliki akun PPI?{" "}
                    <Link
                      href="/sign-up"
                      className="text-red-600 hover:text-red-700 font-bold hover:underline"
                    >
                      Daftar Akun Baru
                    </Link>
                  </p>
                </div>
              </form>
            </>
          ) : (
            /* =============================================================== */
            /* MODE 2: PENDAFTARAN AKUN PPI RESMI                             */
            /* =============================================================== */
            <>
              <div className="text-center mb-5">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Pendaftaran Akun PPI
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Registrasi resmi anggota &amp; panitia PPI Kabupaten Probolinggo
                </p>
              </div>

              {regError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <span className="text-red-500">⚠</span>
                  <span>{regError}</span>
                </div>
              )}

              {/* STEP 1: IDENTITAS ANGGOTA PPI */}
              {regStep === 1 && (
                <div className="space-y-4 text-left">
                  {/* Stepper Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        1
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Step 1: Identitas Keanggotaan
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Step 1 dari 2
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-600 h-full w-1/2 transition-all duration-300" />
                  </div>

                  {/* Field 1: Nama Lengkap (Maks 50 Huruf) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Nama Lengkap <span className="text-red-600">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {regFullName.length}/50
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value.slice(0, 50))}
                      placeholder="Masukkan nama lengkap Anda..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition shadow-sm"
                    />
                    {regFullName.length >= 50 && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        Nama lengkap maksimal 50 huruf.
                      </p>
                    )}
                  </div>

                  {/* Field 2: Angkatan PPI (Wajib 4 Angka, Maks Tahun Sekarang) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Angkatan PPI (Tahun) <span className="text-red-600">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Maks. Tahun {currentYear}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={regAngkatan}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                        setRegAngkatan(val);
                      }}
                      placeholder={`Contoh: 2024 atau ${currentYear}`}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border font-mono text-xs sm:text-sm text-slate-900 focus:outline-none transition shadow-sm ${
                        isAngkatanFuture
                          ? "border-red-500 ring-2 ring-red-100 text-red-600"
                          : "border-slate-300 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                      }`}
                    />

                    {isAngkatanFuture && (
                      <div className="mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
                        <span>⛔</span>
                        <span>
                          Angkatan PPI tidak boleh melebihi tahun sekarang (maksimal {currentYear}).
                        </span>
                      </div>
                    )}

                    {regAngkatan.length > 0 && regAngkatan.length < 4 && (
                      <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                        Wajib berupa 4 digit angka tahun (contoh: 2024 atau {currentYear}).
                      </p>
                    )}
                  </div>

                  {/* Navigasi Step 1 */}
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <Link
                      href="/login"
                      className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition text-center flex items-center justify-center"
                    >
                      Ke Login
                    </Link>

                    <button
                      type="button"
                      disabled={!isStep1Valid}
                      onClick={() => {
                        setRegError(null);
                        setRegStep(2);
                      }}
                      className={`w-full py-2.5 rounded-xl text-white font-bold text-xs transition shadow-md flex items-center justify-center ${
                        isStep1Valid
                          ? "bg-red-600 hover:bg-red-500 shadow-red-600/30 cursor-pointer"
                          : "bg-red-300 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <span>Lanjut Step 2</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: KONTAK & PASSWORD (PENGECEKAN REALTIME) */}
              {regStep === 2 && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left text-xs sm:text-sm">
                  {/* Stepper Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        ✓
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Step 2: Kontak &amp; Password
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Step 2 dari 2
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-full transition-all duration-300" />
                  </div>

                  {/* Summary of Step 1 */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Calon Anggota Terdata:
                      </span>
                      <strong className="text-slate-800 font-bold truncate block">
                        {regFullName}
                      </strong>
                      <span className="text-slate-500 text-[11px]">
                        PPI Angkatan {regAngkatan}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0 transition"
                    >
                      Ubah Step 1
                    </button>
                  </div>

                  {/* Field 1: Email (Maks 50 huruf, live check) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Alamat Email Aktif <span className="text-red-600">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {regEmail.length}/50
                      </span>
                    </div>
                    <input
                      type="email"
                      required
                      maxLength={50}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value.slice(0, 50))}
                      placeholder="nama@gmail.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border text-slate-900 focus:outline-none transition shadow-sm ${
                        dupStatus.emailTaken || (regEmail.length > 0 && !isEmailFormatValid)
                          ? "border-red-500 ring-2 ring-red-100"
                          : "border-slate-300 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                      }`}
                    />
                    {dupStatus.emailTaken && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        Email ini sudah terdaftar! Gunakan email lain atau login.
                      </p>
                    )}
                    {regEmail.length > 0 && !isEmailFormatValid && !dupStatus.emailTaken && (
                      <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                        Format email belum valid (contoh: nama@gmail.com, maks. 50 huruf).
                      </p>
                    )}
                  </div>

                  {/* Field 2: WhatsApp (Min 9, Max 13, prefix 08, dilarang beruntun) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Nomor WhatsApp <span className="text-red-600">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cleanPhone.length}/13 digit (Min. 9 digit, awal 08)
                      </span>
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={13}
                      value={regPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                        setRegPhone(digits);
                      }}
                      placeholder="Contoh: 081234567890"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border font-mono text-slate-900 focus:outline-none transition shadow-sm ${
                        (regPhone.length > 0 && (!isPhone08 || !isPhoneLenValid || isPhoneRepeating)) || dupStatus.phoneTaken
                          ? "border-red-500 ring-2 ring-red-100"
                          : "border-slate-300 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                      }`}
                    />
                    {regPhone.length > 0 && !isPhone08 && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        Nomor WhatsApp wajib diawali &apos;08&apos;.
                      </p>
                    )}
                    {isPhoneRepeating && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        Dilarang menggunakan pola nomor angka beruntun/berulang!
                      </p>
                    )}
                    {regPhone.length > 0 && isPhone08 && !isPhoneLenValid && !isPhoneRepeating && (
                      <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                        Panjang nomor WhatsApp minimal 9 digit dan maksimal 13 digit.
                      </p>
                    )}
                    {dupStatus.phoneTaken && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        Nomor WhatsApp ini sudah terdaftar!
                      </p>
                    )}
                  </div>

                  {/* Field 3: Password (Realtime checklist) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Password Akun <span className="text-red-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                      >
                        {showRegPassword ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Buat password kombinasi yang kuat..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition shadow-sm"
                    />

                    {/* Realtime Password Checklist Visual Badges */}
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-1.5 text-[11px]">
                      <span className={`flex items-center gap-1 font-semibold ${pwdHasMinLen ? "text-emerald-600" : "text-slate-400"}`}>
                        <span>{pwdHasMinLen ? "✓" : "○"}</span>
                        <span>Min. 8 Karakter</span>
                      </span>
                      <span className={`flex items-center gap-1 font-semibold ${pwdHasUpper ? "text-emerald-600" : "text-slate-400"}`}>
                        <span>{pwdHasUpper ? "✓" : "○"}</span>
                        <span>Huruf Besar (A-Z)</span>
                      </span>
                      <span className={`flex items-center gap-1 font-semibold ${pwdHasLower ? "text-emerald-600" : "text-slate-400"}`}>
                        <span>{pwdHasLower ? "✓" : "○"}</span>
                        <span>Huruf Kecil (a-z)</span>
                      </span>
                      <span className={`flex items-center gap-1 font-semibold ${pwdHasNumber ? "text-emerald-600" : "text-slate-400"}`}>
                        <span>{pwdHasNumber ? "✓" : "○"}</span>
                        <span>Angka (0-9)</span>
                      </span>
                      <span className={`col-span-2 flex items-center gap-1 font-semibold ${pwdHasSymbol ? "text-emerald-600" : "text-slate-400"}`}>
                        <span>{pwdHasSymbol ? "✓" : "○"}</span>
                        <span>Ikon / Simbol Unik (!@#$% dll.)</span>
                      </span>
                    </div>
                  </div>

                  {/* Field 4: Captcha */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 flex items-center justify-center gap-2 select-none h-10 shadow-inner">
                        {captchaLoading || !captchaCode ? (
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <span className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            <span>Memuat captcha...</span>
                          </div>
                        ) : (
                          captchaCode.split("").map((ch, idx) => (
                            <span
                              key={idx}
                              style={{ color: CAPTCHA_COLORS[idx % CAPTCHA_COLORS.length] }}
                              className="font-black text-base font-mono"
                            >
                              {ch}
                            </span>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={captchaLoading || captchaRotating}
                        onClick={refreshCaptcha}
                        className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition disabled:opacity-60 shadow-sm"
                        title="Ganti Kode Captcha"
                      >
                        🔄
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                      placeholder="MASUKKAN 5 KODE CAPTCHA DI ATAS"
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-center font-mono font-bold uppercase tracking-wider text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 shadow-sm transition [color-scheme:light]"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition text-center flex items-center justify-center"
                    >
                      Kembali ke Step 1
                    </button>

                    <button
                      type="submit"
                      disabled={!isStep2Valid || regBusy}
                      className={`w-full py-2.5 rounded-xl text-white font-bold text-xs transition shadow-md flex items-center justify-center ${
                        isStep2Valid && !regBusy
                          ? "bg-red-600 hover:bg-red-500 shadow-red-600/30 cursor-pointer"
                          : "bg-red-300 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      {regBusy ? "Mendaftarkan..." : "Daftar Akun Sekarang"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer Right ala Dishub */}
        <div className="max-w-md w-full mx-auto text-center mt-6 relative z-10">
          <p className="text-[11px] text-slate-400">
            © 2026 Purna Paskibraka Indonesia Kabupaten Probolinggo
          </p>
        </div>
      </div>

      {/* MODAL LUPA PASSWORD (RESET PASSWORD VIA OTP GMAIL) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-slate-800 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              🔑
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Reset Password Akun PPI</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {forgotStep === 1
                  ? "Masukkan alamat email yang terdaftar untuk menerima kode verifikasi OTP 6 digit."
                  : `Kode OTP telah dikirim ke ${forgotEmail}. Masukkan kode dan buat password baru.`}
              </p>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {forgotError}
              </div>
            )}

            {forgotMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                {forgotMessage}
              </div>
            )}

            {forgotStep === 1 ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!forgotEmail.trim()) return;
                  setForgotBusy(true);
                  setForgotError(null);
                  setForgotMessage(null);
                  try {
                    const res = await fetch("/api/auth", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "request_forgot_otp",
                        email: forgotEmail.trim(),
                      }),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      setForgotError(d.error || "Gagal mengirim kode OTP.");
                    } else {
                      setForgotMessage(d.message);
                      setForgotStep(2);
                    }
                  } catch {
                    setForgotError("Gangguan jaringan saat menghubungi server.");
                  } finally {
                    setForgotBusy(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Terdaftar <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 shadow-sm transition [color-scheme:light]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotStep(1);
                      setForgotError(null);
                      setForgotMessage(null);
                    }}
                    className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={forgotBusy}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white text-xs font-bold shadow-md shadow-red-600/30 transition"
                  >
                    {forgotBusy ? "Mengirim..." : "Kirim OTP"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!forgotOtp.trim() || !forgotNewPassword) return;
                  setForgotBusy(true);
                  setForgotError(null);
                  try {
                    const res = await fetch("/api/auth", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "verify_reset_password_otp",
                        email: forgotEmail.trim(),
                        otp: forgotOtp.trim(),
                        newPassword: forgotNewPassword,
                      }),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      setForgotError(d.error || "Gagal memperbarui password.");
                    } else {
                      await showSuccess("Berhasil!", d.message);
                      setShowForgotModal(false);
                      setForgotStep(1);
                      setForgotOtp("");
                      setForgotNewPassword("");
                    }
                  } catch {
                    setForgotError("Gangguan jaringan saat menghubungi server.");
                  } finally {
                    setForgotBusy(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode OTP 6 Digit <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="Contoh: 123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-mono text-center tracking-widest text-sm font-bold focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 shadow-sm transition [color-scheme:light]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password Baru <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 shadow-sm transition [color-scheme:light]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={forgotBusy}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white text-xs font-bold shadow-md shadow-red-600/30 transition"
                  >
                    {forgotBusy ? "Menyimpan..." : "Simpan Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

