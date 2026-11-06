/**
 * Utility for parsing roadshow dates, times, and auto-resolving live status.
 * Automatically switches status from "AKAN_DIKUNJUNGI" to "SEDANG_BERLANGSUNG"
 * once the scheduled start time arrives on the visit date (WIB / Asia/Jakarta).
 */

const ID_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  agu: 7,
  agus: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  des: 11,
};

export function getWibNow(): Date {
  try {
    const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    return new Date(s);
  } catch {
    // Fallback to UTC+7 offset
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 7 * 3600000);
  }
}

/**
 * Checks if a string date (e.g., "06 November 2026", "2026-11-06", "HARI INI") matches today in WIB
 */
export function isDateTodayWib(dateStr?: string): boolean {
  if (!dateStr) return false;
  const raw = dateStr.toLowerCase().trim();
  if (raw === "hari ini" || raw.includes("hari ini")) return true;

  const wib = getWibNow();
  const currentYear = wib.getFullYear();
  const currentMonth = wib.getMonth(); // 0-11
  const currentDate = wib.getDate();

  // Try ISO format: YYYY-MM-DD
  const isoMatch = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return y === currentYear && m === currentMonth && d === currentDate;
  }

  // Try DD-MM-YYYY format
  const ddmmyyyyMatch = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyyMatch) {
    const d = parseInt(ddmmyyyyMatch[1], 10);
    const m = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const y = parseInt(ddmmyyyyMatch[3], 10);
    return y === currentYear && m === currentMonth && d === currentDate;
  }

  // Try text format: "06 November 2026" or "6 November"
  const tokens = raw.replace(/[,\.]/g, " ").split(/\s+/).filter(Boolean);
  let parsedDay: number | null = null;
  let parsedMonth: number | null = null;
  let parsedYear: number | null = null;

  for (const token of tokens) {
    if (ID_MONTHS[token] !== undefined) {
      parsedMonth = ID_MONTHS[token];
      continue;
    }
    const num = parseInt(token, 10);
    if (!isNaN(num)) {
      if (num > 1900 && num < 2100) {
        parsedYear = num;
      } else if (num >= 1 && num <= 31 && parsedDay === null) {
        parsedDay = num;
      }
    }
  }

  if (parsedDay !== null && parsedMonth !== null) {
    const matchesDayMonth = parsedDay === currentDate && parsedMonth === currentMonth;
    if (parsedYear !== null) {
      return matchesDayMonth && parsedYear === currentYear;
    }
    return matchesDayMonth;
  }

  return false;
}

/**
 * Extracts start & optional end time in minutes from midnight from a time string
 * E.g. "12:00" -> start: 720
 * E.g. "08:00 - 12:00 WIB" -> start: 480, end: 720
 */
export function parseTimeRange(timeStr?: string): { startMinutes: number; endMinutes?: number } {
  const defaultRes = { startMinutes: 8 * 60, endMinutes: 12 * 60 }; // 08:00
  if (!timeStr) return defaultRes;

  const matches = Array.from(timeStr.matchAll(/(\d{1,2})[:.](\d{2})/g));
  if (!matches || matches.length === 0) {
    // If just single number like "12" or "jam 12"
    const singleHourMatch = timeStr.match(/(?:jam\s*)?(\d{1,2})(?!\d)/i);
    if (singleHourMatch) {
      const h = parseInt(singleHourMatch[1], 10);
      if (h >= 0 && h <= 23) {
        return { startMinutes: h * 60 };
      }
    }
    return defaultRes;
  }

  const startH = parseInt(matches[0][1], 10);
  const startM = parseInt(matches[0][2], 10);
  const startMinutes = startH * 60 + startM;

  if (matches.length >= 2) {
    const endH = parseInt(matches[1][1], 10);
    const endM = parseInt(matches[1][2], 10);
    const endMinutes = endH * 60 + endM;
    return { startMinutes, endMinutes };
  }

  return { startMinutes };
}

/**
 * Dynamically resolves roadshow post status.
 * If status is "AKAN_DIKUNJUNGI", date is today, and current time >= start time,
 * it automatically promotes to "SEDANG_BERLANGSUNG".
 */
export function resolveAutoPostStatus(post: {
  status: string;
  date: string;
  time?: string;
}): "AKAN_DIKUNJUNGI" | "SEDANG_BERLANGSUNG" | "SUDAH_DIKUNJUNGI" {
  // If explicitly already finished / sudah dikunjungi, respect it
  if (post.status === "SUDAH_DIKUNJUNGI") {
    return "SUDAH_DIKUNJUNGI";
  }

  // Check if date is today
  const isToday = isDateTodayWib(post.date);
  if (!isToday) {
    return post.status === "SEDANG_BERLANGSUNG" ? "SEDANG_BERLANGSUNG" : "AKAN_DIKUNJUNGI";
  }

  const wib = getWibNow();
  const currentMinutes = wib.getHours() * 60 + wib.getMinutes();
  const { startMinutes, endMinutes } = parseTimeRange(post.time);

  // If time has arrived (current >= start)
  if (currentMinutes >= startMinutes) {
    // If an explicit end time has passed by more than 2 hours, it could be marked done or stay sedang berlangsung.
    // By user specification: "jika aku buat acara /yg akan diknjungi dan taruh misal jam 12 nnti jam 12 otomatis lgg pindh k sedang berlangsung"
    return "SEDANG_BERLANGSUNG";
  }

  // Not yet started
  return "AKAN_DIKUNJUNGI";
}
