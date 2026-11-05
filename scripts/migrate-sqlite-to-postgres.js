/**
 * Menyalin SELURUH data dari SQLite lokal (prisma/dev.db) ke PostgreSQL (DATABASE_URL).
 *
 * Cara pakai:
 *   1. Isi DATABASE_URL di .env dengan URL PostgreSQL (Neon / Supabase)
 *   2. npm run db:setup          (membuat tabel)
 *   3. npm run db:migrate-data   (menyalin data lokal ke PostgreSQL)
 *
 * Aman dijalankan berulang kali (data yang sudah ada dilewati).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd();
const pgUrl = (() => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return "";
})();

if (!/^postgres(ql)?:\/\//i.test(pgUrl)) {
  console.error("DATABASE_URL di .env belum berupa URL PostgreSQL (postgresql://...). Dibatalkan.");
  process.exit(1);
}

const sqliteFile = path.join(root, "prisma", "dev.db");
if (!fs.existsSync(sqliteFile)) {
  console.error("File prisma/dev.db tidak ditemukan. Tidak ada data lokal untuk disalin.");
  process.exit(1);
}

// 1. Buat Prisma Client khusus SQLite (terpisah dari client utama)
const schemaText = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
const sqliteSchema = schemaText
  .replace(/datasource db \{[\s\S]*?\n\}/, 'datasource db {\n  provider = "sqlite"\n  url      = "file:./dev.db"\n}')
  .replace(
    /generator client \{[\s\S]*?\n\}/,
    'generator client {\n  provider = "prisma-client-js"\n  output   = "../node_modules/.prisma/client-sqlite"\n}'
  );
const tmpSchema = path.join(root, "prisma", "_sqlite_tmp.prisma");
fs.writeFileSync(tmpSchema, sqliteSchema);
try {
  execSync(`npx prisma generate --schema prisma/_sqlite_tmp.prisma`, { stdio: "inherit" });
} finally {
  fs.unlinkSync(tmpSchema);
}

const { PrismaClient: SqliteClient } = require(path.join(root, "node_modules", ".prisma", "client-sqlite"));
const { PrismaClient: PgClient, Prisma } = require("@prisma/client");

const src = new SqliteClient({ datasources: { db: { url: `file:${sqliteFile.replace(/\\/g, "/")}` } } });
const dst = new PgClient({ datasources: { db: { url: pgUrl } } });

const ORDER = [
  "UserAccount",
  "LandingConfig",
  "LandingItem",
  "Review",
  "RoadshowSchool",
  "RoadshowCandidate",
  "RoadshowPost",
  "SecurityAuditLog",
];

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

(async () => {
  const known = Prisma.dmmf.datamodel.models.map((m) => m.name);
  for (const name of ORDER) {
    if (!known.includes(name)) continue;
    const key = lowerFirst(name);
    const rows = await src[key].findMany();
    if (rows.length === 0) {
      console.log(`- ${name}: kosong`);
      continue;
    }
    let inserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const res = await dst[key].createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
      inserted += res.count;
    }
    console.log(`- ${name}: ${rows.length} baris lokal, ${inserted} baru disalin`);
  }

  // Tandai database sudah di-seed supaya data contoh tidak dibuat ulang / data terhapus tidak muncul lagi
  await dst.systemFlag.upsert({
    where: { key: "seed_v1" },
    update: {},
    create: { key: "seed_v1", value: new Date().toISOString() },
  });
  console.log("Selesai. Data lokal kini ada di PostgreSQL.");
})()
  .catch((e) => {
    console.error("Gagal migrasi:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.$disconnect();
    await dst.$disconnect();
  });
