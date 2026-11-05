/**
 * Dipakai saat build di hosting: membuat/menyesuaikan tabel di PostgreSQL otomatis.
 * (Tidak menghapus data. Dilewati untuk SQLite lokal.)
 */
const { execSync } = require("child_process");

const url = process.env.DATABASE_URL || "";
if (/^postgres(ql)?:\/\//i.test(url)) {
  console.log("[push-db] prisma db push ke PostgreSQL...");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else {
  console.log("[push-db] DATABASE_URL bukan PostgreSQL, dilewati.");
}
