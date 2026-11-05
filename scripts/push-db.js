/**
 * Dipakai saat build di hosting: membuat/menyesuaikan tabel di TiDB otomatis.
 * (Tidak menghapus data.)
 */
const { execSync } = require("child_process");

const url = process.env.DATABASE_URL || "";
if (/^mysql:\/\//i.test(url)) {
  console.log("[push-db] prisma db push ke TiDB...");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else {
  console.log("[push-db] DATABASE_URL bukan mysql://, dilewati (isi DATABASE_URL TiDB di Environment Variables hosting).");
}
