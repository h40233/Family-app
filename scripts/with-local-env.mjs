import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const originalEnvKeys = new Set(Object.keys(process.env));

loadEnvFile(".env");
loadEnvFile(".env.local");

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-local-env.mjs <command> [...args]");
  process.exit(1);
}

const childCommand = commandSpec(command, args);
const child = spawn(childCommand.command, childCommand.args, {
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    if (!originalEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

function resolveCommand(command) {
  if (process.platform !== "win32") return command;
  if (/\.(cmd|bat|exe)$/i.test(command)) return command;
  if (command.toLowerCase() === "node") return command;

  return `${command}.cmd`;
}

function commandSpec(command, args) {
  const normalized = command.toLowerCase();

  if (normalized === "prisma") {
    return {
      command: process.execPath,
      args: [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), ...args]
    };
  }

  if (normalized === "tsx") {
    return {
      command: process.execPath,
      args: [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), ...args]
    };
  }

  return {
    command: resolveCommand(command),
    args
  };
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
  if (!match) return null;

  const [, key, rawValue] = match;
  return [key, unquote(rawValue)];
}

function unquote(rawValue) {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, "");
}
