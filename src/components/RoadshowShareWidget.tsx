"use client";

import React, { useState } from "react";

interface RoadshowShareWidgetProps {
  title: string;
  url: string;
  schoolName?: string;
}

export default function RoadshowShareWidget({ title, url, schoolName }: RoadshowShareWidgetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Kabar Roadshow PPI di ${schoolName || "Sekolah"}: ${title}`,
          url,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      handleCopy();
    }
  };

  const waText = encodeURIComponent(
    `*${title}*\n\nBaca liputan & pengumuman resmi Roadshow PPI Kabupaten Probolinggo untuk ${schoolName || "sekolah"} di link berikut:\n${url}`
  );
  const waUrl = `https://api.whatsapp.com/send?text=${waText}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 my-6 text-white shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-zinc-800/80">
        <div>
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <span>Bagikan Berita Ini</span>
          </h4>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Sebarkan informasi resmi kunjungan &amp; hasil seleksi ke grup sekolah &amp; media sosial
          </p>
        </div>

        {/* Copy Link Status Pill */}
        {copied && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-fade-in self-start sm:self-auto">
            <span>Link Berhasil Disalin!</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* WhatsApp Share Button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-95"
        >
          <span>WhatsApp</span>
        </a>

        {/* Facebook Share Button */}
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition active:scale-95"
        >
          <span>Facebook</span>
        </a>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopy}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition active:scale-95 border ${
            copied
              ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600"
          }`}
        >
          <span>{copied ? "Tersalin!" : "Salin Link Berita"}</span>
        </button>

        {/* Native Mobile Share (if available) */}
        <button
          type="button"
          onClick={handleNativeShare}
          className="px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-zinc-700 transition active:scale-95 sm:hidden"
        >
          <span>Lainnya</span>
        </button>
      </div>

      {/* Preview Link Box */}
      <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center gap-2">
        <span className="text-[10px] text-zinc-400 font-mono uppercase shrink-0">Link:</span>
        <span className="text-xs text-emerald-400 font-mono truncate select-all">
          {url}
        </span>
      </div>
    </div>
  );
}

