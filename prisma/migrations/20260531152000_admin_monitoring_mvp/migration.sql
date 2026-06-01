ALTER TABLE "users"
  ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "banned_at" TIMESTAMPTZ(6),
  ADD COLUMN "banned_reason" TEXT;

CREATE INDEX "users_is_admin_idx" ON "users"("is_admin");
CREATE INDEX "users_banned_at_idx" ON "users"("banned_at");
