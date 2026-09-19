-- CreateEnum
CREATE TYPE "FormPurpose" AS ENUM ('REGISTRATION', 'SUBMISSION', 'FEEDBACK', 'CUSTOM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'MULTI_SELECT';
ALTER TYPE "FieldType" ADD VALUE 'RADIO';

-- DropIndex
DROP INDEX "event_form_fields_event_id_field_definition_id_key";

-- DropIndex
DROP INDEX "event_registration_responses_event_registration_id_field_de_key";

-- AlterTable
ALTER TABLE "event_form_fields" ADD COLUMN     "form_id" UUID;

-- AlterTable
ALTER TABLE "event_registration_responses" ADD COLUMN     "form_id" UUID;

-- CreateTable
CREATE TABLE "event_forms" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "purpose" "FormPurpose" NOT NULL,
    "title" TEXT NOT NULL,
    "release_at" TIMESTAMPTZ(6),
    "close_at" TIMESTAMPTZ(6),
    "notified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_form_fields_event_id_form_id_field_definition_id_key" ON "event_form_fields"("event_id", "form_id", "field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registration_responses_event_registration_id_form_id__key" ON "event_registration_responses"("event_registration_id", "form_id", "field_definition_id");

-- AddForeignKey
ALTER TABLE "event_forms" ADD CONSTRAINT "event_forms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_form_fields" ADD CONSTRAINT "event_form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "event_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_responses" ADD CONSTRAINT "event_registration_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "event_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create partial unique index for legacy event form fields (where form_id is NULL)
CREATE UNIQUE INDEX "event_form_fields_event_id_field_definition_id_legacy_key" ON "event_form_fields"("event_id", "field_definition_id") WHERE "form_id" IS NULL;

-- Create partial unique index for legacy event registration responses (where form_id is NULL)
CREATE UNIQUE INDEX "event_registration_responses_event_reg_id_field_def_legacy_key" ON "event_registration_responses"("event_registration_id", "field_definition_id") WHERE "form_id" IS NULL;


-- Grant permissions for new tables to application roles
GRANT ALL ON event_forms TO nst_app;

-- Worker trust boundary extensions for form release sweep
-- The worker needs to read event_forms, update their notified_at, and read registrations for those specific events.
-- It also now acts as a notification producer, so it needs INSERT on notification queues.

GRANT SELECT, UPDATE (notified_at) ON event_forms TO nst_worker;
GRANT SELECT ON event_registrations TO nst_worker;
GRANT INSERT, SELECT ON notification_jobs TO nst_worker;
GRANT INSERT, SELECT ON notifications TO nst_worker;

-- Allow worker to read and update event_forms
CREATE POLICY "Worker system access to event_forms" ON event_forms FOR ALL TO nst_worker USING (true) WITH CHECK (true);

-- Allow worker to read ONLY registrations for events that have pending form releases
CREATE POLICY "Worker system access to event_registrations" ON event_registrations FOR SELECT TO nst_worker USING (
    EXISTS (
        SELECT 1 FROM event_forms ef
        WHERE ef.event_id = event_registrations.event_id
          AND ef.release_at <= now()
          AND ef.notified_at IS NULL
    )
);

-- Allow worker to enqueue notifications
CREATE POLICY "Worker system insert notifications" ON notifications FOR INSERT TO nst_worker WITH CHECK (true);
CREATE POLICY "Worker system select notifications" ON notifications FOR SELECT TO nst_worker USING (true);
