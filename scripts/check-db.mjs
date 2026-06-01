import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the database check.");
  }

  await prisma.$queryRaw`SELECT 1`;

  let migrationCount = null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
    `;
    migrationCount = Number(rows[0]?.count ?? 0);
  } catch {
    migrationCount = 0;
  }

  console.log(
    `Database check passed. Applied migrations: ${migrationCount}.`,
  );
}

main()
  .catch((error) => {
    console.error("Database check failed.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
