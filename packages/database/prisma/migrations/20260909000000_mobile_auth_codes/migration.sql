-- CreateTable
CREATE TABLE "mobile_auth_codes" (
    "code" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_auth_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "mobile_auth_codes_expires_at_idx" ON "mobile_auth_codes"("expires_at");

-- Row Level Security
ALTER TABLE "mobile_auth_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mobile_auth_codes" FORCE ROW LEVEL SECURITY;

-- Allow system user nst_app full access
CREATE POLICY "Allow nst_app ALL on mobile_auth_codes" ON "mobile_auth_codes"
    FOR ALL TO nst_app
    USING (true)
    WITH CHECK (true);

-- Grant privileges
GRANT ALL ON "mobile_auth_codes" TO nst_app;
