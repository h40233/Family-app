CREATE TABLE "family_role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_id" UUID NOT NULL,
    "role" "family_role" NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "family_role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "family_role_permissions_family_id_role_key"
    ON "family_role_permissions"("family_id", "role");

CREATE INDEX "family_role_permissions_family_id_idx"
    ON "family_role_permissions"("family_id");

ALTER TABLE "family_role_permissions"
    ADD CONSTRAINT "family_role_permissions_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
