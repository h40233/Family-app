import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const database = process.env.FAMILY_OS_LOCAL_DB_NAME ?? "family_os";
const user = process.env.FAMILY_OS_LOCAL_DB_USER ?? "family_os";
const password = process.env.FAMILY_OS_LOCAL_DB_PASSWORD ?? "family_os";
const port = process.env.FAMILY_OS_LOCAL_DB_PORT ?? "55432";
const host = "localhost";
const rootDir = resolve(process.cwd(), ".scratch", "local-postgres");
const dataDir = join(rootDir, "data");
const logFile = join(rootDir, "postgres.log");
const passwordFile = join(rootDir, "pwfile");
const binDir = findPostgresBin();
const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "start") {
    start();
  } else if (command === "stop") {
    stop();
  } else if (command === "status") {
    status();
  } else if (command === "env") {
    printEnv();
  } else if (command === "run") {
    runInLocalDb(args);
  } else if (command === "verify") {
    verify();
  } else {
    help(command !== "help");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function start() {
  initCluster();

  if (!isReady()) {
    run("pg_ctl", ["-D", dataDir, "-l", logFile, "start", "-w"]);
  }

  ensureDatabase();
  console.log(`Local PostgreSQL is ready at ${databaseUrl}`);
}

function stop() {
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    console.log("Local PostgreSQL data directory does not exist.");
    return;
  }

  run("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"], { allowFailure: true });
}

function status() {
  const ready = isReady();
  console.log(ready ? `Local PostgreSQL is accepting connections on port ${port}.` : "Local PostgreSQL is not running.");
  process.exit(ready ? 0 : 1);
}

function printEnv() {
  console.log(`DATABASE_URL="${databaseUrl}"`);
  console.log(`DIRECT_URL="${databaseUrl}"`);
}

function runInLocalDb(args) {
  if (args.length === 0) {
    throw new Error("Usage: node scripts/local-postgres.mjs run <command> [...args]");
  }

  start();

  const [childCommand, ...childArgs] = args;
  const child = commandSpec(childCommand, childArgs);
  const result = spawnSync(child.command, child.args, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl
    },
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function verify() {
  start();

  const checks = [
    ["prisma", "migrate", "deploy"],
    ["tsx", "prisma/seed.ts"],
    ["node", "scripts/check-db.mjs"],
    ["tsx", "scripts/check-money-db.ts"]
  ];

  for (const check of checks) {
    const [childCommand, ...childArgs] = check;
    const child = commandSpec(childCommand, childArgs);
    const result = spawnSync(child.command, child.args, {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl
      },
      stdio: "inherit"
    });

    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function initCluster() {
  if (existsSync(join(dataDir, "PG_VERSION"))) return;

  mkdirSync(rootDir, { recursive: true });
  writeFileSync(passwordFile, password, "utf8");
  run("initdb", [
    "-D",
    dataDir,
    "--username",
    user,
    "--pwfile",
    passwordFile,
    "--auth-host",
    "scram-sha-256",
    "--auth-local",
    "trust",
    "--encoding",
    "UTF8"
  ]);

  writeFileSync(
    join(dataDir, "postgresql.auto.conf"),
    `port = ${port}\nlisten_addresses = 'localhost'\n`,
    "utf8"
  );
}

function ensureDatabase() {
  const existing = query(
    "postgres",
    `SELECT 1 FROM pg_database WHERE datname = '${database.replaceAll("'", "''")}';`
  );

  if (existing.trim() === "1") return;

  run("createdb", ["-h", host, "-p", port, "-U", user, database], {
    env: { PGPASSWORD: password }
  });
}

function query(dbName, sql, options = {}) {
  const env = { PGPASSWORD: password, ...options.env };
  const args = ["-h", host, "-p", port, "-U", user, "-d", dbName, "-tAc", sql];

  return run("psql", args, { env, capture: true }).stdout;
}

function isReady() {
  if (!existsSync(join(dataDir, "PG_VERSION"))) return false;

  const result = spawnSync(binary("pg_isready"), ["-h", host, "-p", port, "-U", user], {
    env: { ...process.env, PGPASSWORD: password },
    stdio: "ignore"
  });

  return result.status === 0;
}

function run(name, args, options = {}) {
  const result = spawnSync(binary(name), args, {
    env: {
      ...process.env,
      ...(options.env ?? {})
    },
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.status !== 0 && !options.allowFailure) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${name} ${args.join(" ")} failed.${details ? `\n${details}` : ""}`);
  }

  return result;
}

function binary(name) {
  const extension = process.platform === "win32" ? ".exe" : "";
  return join(binDir, `${name}${extension}`);
}

function findPostgresBin() {
  const candidates = [
    process.env.POSTGRES_BIN,
    "D:\\PostgreSQL\\bin",
    "C:\\Program Files\\PostgreSQL\\18\\bin",
    "C:\\Program Files\\PostgreSQL\\17\\bin",
    "C:\\Program Files\\PostgreSQL\\16\\bin"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const psql = join(candidate, process.platform === "win32" ? "psql.exe" : "psql");
    if (existsSync(psql)) return candidate;
  }

  for (const entry of process.env.PATH?.split(delimiter) ?? []) {
    const psql = join(entry, process.platform === "win32" ? "psql.exe" : "psql");
    if (existsSync(psql)) return entry;
  }

  throw new Error("PostgreSQL binaries were not found. Set POSTGRES_BIN to the directory containing psql.");
}

function resolveCommand(command) {
  const localBin = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" && !/\.(cmd|bat|exe)$/i.test(command)
      ? `${command}.cmd`
      : command
  );
  if (existsSync(localBin)) return localBin;

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

function help(failed) {
  console.log("Usage: node scripts/local-postgres.mjs <start|stop|status|env|run|verify>");
  process.exit(failed ? 1 : 0);
}
