/**
 * Utility to generate and parse SEO-friendly roadshow slugs
 * Format: {nama-sekolah}-{alamat}
 * Example: sma-hati-bilingual-boarding-school-kraksaan
 */

export function toRoadshowSlug(schoolName?: string, location?: string): string {
  const cleanSchool = (schoolName || "").trim();
  const cleanLoc = (location || "").trim();
  const combined = cleanLoc ? `${cleanSchool} ${cleanLoc}` : cleanSchool;
  
  return combined
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s-]/g, "")   // remove invalid chars
    .trim()
    .replace(/\s+/g, "-")          // spaces to hyphen
    .replace(/-+/g, "-")           // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");      // trim hyphens
}

export function getRoadshowShareUrl(schoolName?: string, location?: string, fallbackId?: string): string {
  const slug = toRoadshowSlug(schoolName, location) || fallbackId || "";
  const baseUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://www.ppikabupatenprobolinggo.id";
  return `${baseUrl}/roadshow/${slug}`;
}

