import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for database backup.");
  process.exit(1);
}

const outputDir = process.env.BACKUP_DIR ?? "backups";
await mkdir(outputDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = path.join(outputDir, `family-os-${timestamp}.dump`);

const child = spawn("pg_dump", [databaseUrl, "--format=custom", "--file", outputPath], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`Database backup written to ${outputPath}`);
    return;
  }

  console.error("Database backup failed. Ensure pg_dump is installed and on PATH.");
  process.exit(code ?? 1);
});
