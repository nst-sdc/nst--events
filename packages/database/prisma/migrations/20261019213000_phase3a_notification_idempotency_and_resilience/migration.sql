-- Migration: 20261019213000_phase3a_notification_idempotency_and_resilience
-- Purpose:
--   1. Add idempotency_key column and unique constraint to notifications table.
--   2. Ensure RLS policies allow nst_app to perform system updates and upserts on notifications.

-- 1. Add idempotency_key column and unique constraint to notifications table
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- 2. Ensure RLS policies allow nst_app to perform system updates/inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'System can update notifications'
  ) THEN
    CREATE POLICY "System can update notifications" ON notifications FOR UPDATE TO nst_app USING (true) WITH CHECK (true);
  END IF;
END $$;
