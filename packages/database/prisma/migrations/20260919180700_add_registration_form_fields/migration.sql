-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'URL', 'EMAIL', 'NUMBER', 'PHONE', 'SELECT');

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "FieldType" NOT NULL,
    "options" JSONB,
    "is_reusable" BOOLEAN NOT NULL DEFAULT true,
    "created_by_club_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profile_values" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_profile_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_form_fields" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,

    CONSTRAINT "event_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registration_responses" (
    "id" UUID NOT NULL,
    "event_registration_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registration_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_key_key" ON "field_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_values_user_id_field_definition_id_key" ON "student_profile_values"("user_id", "field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_form_fields_event_id_field_definition_id_key" ON "event_form_fields"("event_id", "field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registration_responses_event_registration_id_field_de_key" ON "event_registration_responses"("event_registration_id", "field_definition_id");

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_created_by_club_id_fkey" FOREIGN KEY ("created_by_club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_values" ADD CONSTRAINT "student_profile_values_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_values" ADD CONSTRAINT "student_profile_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_form_fields" ADD CONSTRAINT "event_form_fields_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_form_fields" ADD CONSTRAINT "event_form_fields_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_responses" ADD CONSTRAINT "event_registration_responses_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_responses" ADD CONSTRAINT "event_registration_responses_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
