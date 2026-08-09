CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'classic',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ad_placements" ("id", "name", "location", "enabled", "label")
VALUES
    ('dashboard-banner', 'Dashboard banner', 'dashboard', true, 'MVP house ad'),
    ('reports-inline', 'Reports inline', 'reports', true, 'MVP sponsor slot'),
    ('route-interstitial', 'Route interstitial', 'route-change', true, 'MVP route sponsor')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
