CREATE TABLE "billing_checkout_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_session_id" TEXT,
    "plan" "plan_type" NOT NULL,
    "status" TEXT NOT NULL,
    "checkout_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "provider_session_id" TEXT,
    "plan" TEXT NOT NULL,
    "raw_body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_checkout_sessions_provider_provider_session_id_key"
    ON "billing_checkout_sessions"("provider", "provider_session_id");

CREATE INDEX "billing_checkout_sessions_family_id_idx"
    ON "billing_checkout_sessions"("family_id");

CREATE UNIQUE INDEX "billing_webhook_events_provider_provider_event_id_key"
    ON "billing_webhook_events"("provider", "provider_event_id");

CREATE INDEX "billing_webhook_events_family_id_idx"
    ON "billing_webhook_events"("family_id");

CREATE INDEX "billing_webhook_events_provider_session_id_idx"
    ON "billing_webhook_events"("provider_session_id");

ALTER TABLE "billing_checkout_sessions"
    ADD CONSTRAINT "billing_checkout_sessions_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_webhook_events"
    ADD CONSTRAINT "billing_webhook_events_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
