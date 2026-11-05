/**
 * Memilih provider Prisma otomatis berdasarkan DATABASE_URL:
 *   - postgres://  | postgresql://  -> provider "postgresql" (hosting & lokal, data SAMA)
 *   - file:...                      -> provider "sqlite"     (hanya untuk uji coba offline)
 * Jika provider berubah, `prisma generate` dijalankan otomatis.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readEnvFile() {
  const out = {};
  for (const name of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const fileEnv = readEnvFile();
const url = process.env.DATABASE_URL || fileEnv.DATABASE_URL || "";
const direct = process.env.DIRECT_URL || fileEnv.DIRECT_URL || "";
const isPg = /^postgres(ql)?:\/\//i.test(url);
const provider = isPg ? "postgresql" : "sqlite";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const before = fs.readFileSync(schemaPath, "utf8");

const datasource = [
  "datasource db {",
  `  provider = "${provider}"`,
  '  url      = env("DATABASE_URL")',
  ...(isPg && direct ? ['  directUrl = env("DIRECT_URL")'] : []),
  "}",
].join("\n");

const after = before.replace(/datasource db \{[\s\S]*?\n\}/, datasource);

if (after !== before) {
  fs.writeFileSync(schemaPath, after);
  console.log(`[select-db] provider -> ${provider}. Menjalankan prisma generate...`);
  execSync("npx prisma generate", { stdio: "inherit" });
} else {
  console.log(`[select-db] provider: ${provider} (tidak berubah)`);
}

if (!url) {
  console.warn("[select-db] PERINGATAN: DATABASE_URL belum diisi!");
}
