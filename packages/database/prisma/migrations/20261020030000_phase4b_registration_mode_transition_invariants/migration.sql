-- Forward Migration: Phase 4B Registration Mode Transition Invariants
-- Migration: 20261020030000_phase4b_registration_mode_transition_invariants

-- 1. Create or replace the comprehensive registration mode invariants trigger function
CREATE OR REPLACE FUNCTION public.check_event_registration_mode_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 1. Guard REQUIRED -> NOT_REQUIRED transition when active registrations or teams exist
  IF NEW.registration_mode = 'NOT_REQUIRED' AND (OLD.registration_mode = 'REQUIRED' OR OLD.registration_mode IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM event_registrations 
      WHERE event_id = NEW.id AND deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM teams 
      WHERE event_id = NEW.id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot change registration mode to NOT_REQUIRED when registrations or teams exist'
        USING ERRCODE = 'U0059';
    END IF;
  END IF;

  -- 2. Guard PUBLISHED events entering or remaining in REQUIRED mode: must have a valid registration window
  IF NEW.state = 'PUBLISHED' AND NEW.registration_mode = 'REQUIRED' THEN
    IF NEW.registration_start_time IS NULL 
       OR NEW.registration_end_time IS NULL 
       OR NEW.registration_start_time >= NEW.registration_end_time 
       OR NEW.registration_end_time > NEW.end_time THEN
      RAISE EXCEPTION 'Published events in REQUIRED registration mode must have a valid registration window'
        USING ERRCODE = 'U0056';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace old transition trigger with the new comprehensive invariant trigger
DROP TRIGGER IF EXISTS trg_check_event_registration_mode_transition ON events;
DROP TRIGGER IF EXISTS trg_check_event_registration_mode_invariants ON events;

CREATE TRIGGER trg_check_event_registration_mode_invariants
  BEFORE UPDATE OF registration_mode, state, registration_start_time, registration_end_time, end_time ON events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_event_registration_mode_invariants();
