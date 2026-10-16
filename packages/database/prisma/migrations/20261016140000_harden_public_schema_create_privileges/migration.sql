-- Migration: 20261016140000_harden_public_schema_create_privileges
-- Purpose:
-- 1. Audit and revoke CREATE privilege on schema public from PUBLIC and untrusted/application roles (nst_app, nst_worker).
--    This ensures that no untrusted role can create tables, views, functions, or operators in the public schema
--    that could compromise or hijack SECURITY DEFINER functions executing with search_path = public, pg_temp.
-- 2. Explicitly grant USAGE on schema public to PUBLIC, nst_app, and nst_worker to preserve legitimate reading and resolving
--    of existing public schema objects.
-- 3. Ensure only the database owner/superuser (postgres) retains CREATE privileges on schema public.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM nst_app;
REVOKE CREATE ON SCHEMA public FROM nst_worker;

GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO nst_app;
GRANT USAGE ON SCHEMA public TO nst_worker;
