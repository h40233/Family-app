ALTER TABLE "categories"
  ADD COLUMN "parent_id" UUID,
  ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
CREATE INDEX "categories_scope_type_idx" ON "categories"("scope", "type");

INSERT INTO "categories" ("id", "scope", "type", "name", "is_system", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000002101', 'personal', 'expense', '食', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002103', 'personal', 'expense', '交通', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002105', 'personal', 'expense', '住', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002107', 'personal', 'income', '薪資', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002109', 'personal', 'income', '投資', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "family_id" = NULL,
  "user_id" = NULL,
  "parent_id" = NULL,
  "scope" = EXCLUDED."scope",
  "type" = EXCLUDED."type",
  "name" = EXCLUDED."name",
  "is_system" = true,
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "categories" ("id", "parent_id", "scope", "type", "name", "is_system", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000002102', '00000000-0000-4000-8000-000000002101', 'personal', 'expense', '早餐', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002104', '00000000-0000-4000-8000-000000002103', 'personal', 'expense', '公共運輸', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-000000002105', 'personal', 'expense', '水電瓦斯', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002108', '00000000-0000-4000-8000-000000002107', 'personal', 'income', '正職薪資', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000002110', '00000000-0000-4000-8000-000000002109', 'personal', 'income', '股息利息', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "family_id" = NULL,
  "user_id" = NULL,
  "parent_id" = EXCLUDED."parent_id",
  "scope" = EXCLUDED."scope",
  "type" = EXCLUDED."type",
  "name" = EXCLUDED."name",
  "is_system" = true,
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;
