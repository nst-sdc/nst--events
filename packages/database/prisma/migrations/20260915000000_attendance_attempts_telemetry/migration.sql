-- CreateTable
CREATE TABLE "attendance_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_success" BOOLEAN NOT NULL,
    "failure_reason" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distance_meters" DOUBLE PRECISION,
    "gps_accuracy" DOUBLE PRECISION,
    "device_id" TEXT,
    "device_os" TEXT,
    "app_version" TEXT,
    "is_offline_sync" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "attendance_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_attempts_session_id_is_success_idx" ON "attendance_attempts"("session_id", "is_success");
CREATE INDEX "attendance_attempts_user_id_attempted_at_idx" ON "attendance_attempts"("user_id", "attempted_at");
CREATE INDEX "attendance_attempts_failure_reason_idx" ON "attendance_attempts"("failure_reason");

-- AddForeignKey
ALTER TABLE "attendance_attempts" ADD CONSTRAINT "attendance_attempts_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_attempts" ADD CONSTRAINT "attendance_attempts_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE "attendance_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_attempts" FORCE ROW LEVEL SECURITY;

-- Scoped INSERT Policy (matching audit_logs and attendance_records pattern)
CREATE POLICY "Allow INSERT on attendance_attempts" ON "attendance_attempts"
    FOR INSERT TO nst_app
    WITH CHECK (
        user_id = current_user_id()
        OR current_user_id() IS NULL
    );

-- Scoped SELECT Policy (matching attendance_records RBAC scoping)
CREATE POLICY "Allow SELECT on attendance_attempts" ON "attendance_attempts"
    FOR SELECT TO nst_app
    USING (
        user_id = current_user_id()
        OR EXISTS (
            SELECT 1 FROM attendance_sessions s
            JOIN event_clubs ec ON s.event_id = ec.event_id
            WHERE s.id = attendance_attempts.session_id
            AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
        )
    );

-- Grant privileges
GRANT SELECT, INSERT ON "attendance_attempts" TO nst_app;
