ALTER TABLE "budgets" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Budget';
ALTER TABLE "budgets" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "budgets"
SET "name" = CASE
  WHEN "target_type" = 'personal_category' THEN 'Category Budget'
  WHEN "target_type" = 'personal_account' THEN 'Account Budget'
  WHEN "target_type" = 'shared_fund' THEN 'Shared Fund Budget'
  ELSE 'Budget'
END
WHERE "name" = 'Budget';
