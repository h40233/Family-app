export type ThemeId = "classic" | "ocean" | "sunset";

export type UserPreferences = {
  userId: string;
  theme: ThemeId;
  updatedAt: string;
};

export type UpdateUserPreferencesInput = {
  userId: string;
  familyId?: string;
  theme: ThemeId;
};
