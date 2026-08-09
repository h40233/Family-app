import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { getFamilyPlanStatus } from "@/server/plans";
import { getMemoryStore, nowIso } from "@/server/store";
import type { ThemeId, UpdateUserPreferencesInput, UserPreferences } from "./types";

const paidThemes = new Set<ThemeId>(["ocean", "sunset"]);
const themeIds = new Set<ThemeId>(["classic", "ocean", "sunset"]);

export async function getUserPreferences(input: {
  userId: string;
  familyId?: string;
}): Promise<UserPreferences> {
  const stored = usesDatabaseRuntime("preferences")
    ? await getDatabaseUserPreferences(input.userId)
    : getMemoryUserPreferences(input.userId);

  if (!input.familyId || !(await isThemeLocked(stored.theme, input.familyId))) {
    return stored;
  }

  return { ...stored, theme: "classic" };
}

export async function updateUserPreferences(
  input: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  validateTheme(input.theme);

  if (input.familyId && (await isThemeLocked(input.theme, input.familyId))) {
    throw new Error("This theme requires a paid plan.");
  }

  if (usesDatabaseRuntime("preferences")) {
    return updateDatabaseUserPreferences(input.userId, input.theme);
  }

  const store = getMemoryStore();
  const updatedAt = nowIso();
  const existing = store.userPreferences.find((item) => item.userId === input.userId);

  if (existing) {
    existing.theme = input.theme;
    existing.updatedAt = updatedAt;
    return existing;
  }

  const preferences: UserPreferences = {
    userId: input.userId,
    theme: input.theme,
    updatedAt
  };
  store.userPreferences.push(preferences);
  return preferences;
}

function getMemoryUserPreferences(userId: string): UserPreferences {
  return (
    getMemoryStore().userPreferences.find((item) => item.userId === userId) ?? {
      userId,
      theme: "classic",
      updatedAt: nowIso()
    }
  );
}

async function getDatabaseUserPreferences(userId: string): Promise<UserPreferences> {
  const rows = await prisma.$queryRaw<Array<{ theme: string; updated_at: Date }>>`
    SELECT theme, updated_at
    FROM user_preferences
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `;
  const row = rows[0];

  return {
    userId,
    theme: toThemeId(row?.theme),
    updatedAt: row?.updated_at?.toISOString() ?? nowIso()
  };
}

async function updateDatabaseUserPreferences(
  userId: string,
  theme: ThemeId
): Promise<UserPreferences> {
  const updatedAt = new Date();
  await prisma.$executeRaw`
    INSERT INTO user_preferences (user_id, theme, updated_at)
    VALUES (${userId}::uuid, ${theme}, ${updatedAt})
    ON CONFLICT (user_id)
    DO UPDATE SET theme = EXCLUDED.theme, updated_at = EXCLUDED.updated_at
  `;

  return {
    userId,
    theme,
    updatedAt: updatedAt.toISOString()
  };
}

async function isThemeLocked(theme: ThemeId, familyId: string) {
  if (!paidThemes.has(theme)) return false;

  const plan = await getFamilyPlanStatus(familyId);
  return !plan.limits.canUseMultipleThemes;
}

function validateTheme(theme: string): asserts theme is ThemeId {
  if (!themeIds.has(theme as ThemeId)) {
    throw new Error("Unsupported theme.");
  }
}

function toThemeId(value: string | undefined): ThemeId {
  return themeIds.has(value as ThemeId) ? (value as ThemeId) : "classic";
}
