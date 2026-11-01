-- ==============================================================================
-- NST Events - PostgreSQL Cluster-Wide Bootstrap Script
-- Reconstructs cluster-level roles, connection privileges, and database configuration
-- in a freshly initialized PostgreSQL cluster prior to database restoration.
-- Safe to run repeatedly (Idempotent). Does NOT expose superuser password hashes.
-- ==============================================================================

-- 1. Create least-privileged API application runtime role (nst_app)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nst_app') THEN
    CREATE ROLE nst_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Created role: nst_app';
  ELSE
    ALTER ROLE nst_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Role nst_app already exists, verified least-privilege attributes';
  END IF;
END
$$;

-- 2. Create least-privileged background worker runtime role (nst_worker)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nst_worker') THEN
    CREATE ROLE nst_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Created role: nst_worker';
  ELSE
    ALTER ROLE nst_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Role nst_worker already exists, verified least-privilege attributes';
  END IF;
END
$$;

-- 3. Database connection privileges
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'nst_events') THEN
    GRANT CONNECT ON DATABASE nst_events TO nst_app;
    GRANT CONNECT ON DATABASE nst_events TO nst_worker;
  END IF;
  IF current_database() != 'nst_events' THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO nst_app', current_database());
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO nst_worker', current_database());
  END IF;
END
$$;

-- 4. Ensure required database extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 5. Ensure explicit schema ownership by database superuser
ALTER SCHEMA public OWNER TO postgres;

