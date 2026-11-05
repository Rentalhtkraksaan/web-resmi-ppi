import Swal, { SweetAlertOptions, SweetAlertResult } from "sweetalert2";

// Custom styled SweetAlert2 theme matching PPI Kabupaten Probolinggo brand
const PPITheme = Swal.mixin({
  customClass: {
    popup: "rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl font-sans",
    title: "text-lg sm:text-xl font-black text-white tracking-tight",
    htmlContainer: "text-xs sm:text-sm text-zinc-300 leading-relaxed",
    confirmButton:
      "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition mx-1.5 focus:outline-none",
    cancelButton:
      "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition mx-1.5 focus:outline-none",
    denyButton:
      "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white transition mx-1.5 focus:outline-none",
    input:
      "rounded-xl border border-zinc-700 bg-zinc-900 text-white text-sm px-4 py-2.5 focus:border-red-500 focus:outline-none",
  },
  buttonsStyling: false,
  background: "#09090b",
  color: "#f4f4f5",
});

export const showSuccess = (title: string, text?: string): Promise<SweetAlertResult> => {
  return PPITheme.fire({
    icon: "success",
    title,
    text,
    timer: 2500,
    showConfirmButton: false,
    iconColor: "#10b981",
  });
};

export const showError = (title: string, text?: string): Promise<SweetAlertResult> => {
  return PPITheme.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "Mengerti",
    iconColor: "#ef4444",
  });
};

export const showWarning = (title: string, text?: string): Promise<SweetAlertResult> => {
  return PPITheme.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "OK",
    iconColor: "#f59e0b",
  });
};

export const showInfo = (title: string, text?: string): Promise<SweetAlertResult> => {
  return PPITheme.fire({
    icon: "info",
    title,
    text,
    confirmButtonText: "Tutup",
    iconColor: "#3b82f6",
  });
};

export const showConfirm = (
  title: string,
  text: string,
  confirmButtonText = "Ya, Lanjutkan",
  cancelButtonText = "Batal"
): Promise<SweetAlertResult> => {
  return PPITheme.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    iconColor: "#f59e0b",
  });
};

export const showPrompt = (options: SweetAlertOptions): Promise<SweetAlertResult> => {
  return PPITheme.fire(options);
};

export default PPITheme;

