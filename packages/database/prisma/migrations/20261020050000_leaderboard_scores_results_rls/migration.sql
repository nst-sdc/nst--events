-- Row-Level Security policies on leaderboard_scores for competition score reconciliation
DROP POLICY IF EXISTS "leaderboard_scores_insert_policy" ON leaderboard_scores;
CREATE POLICY "leaderboard_scores_insert_policy" ON leaderboard_scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR (
      source_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM event_awards ea
        JOIN event_result_revisions err ON err.id = ea.revision_id
        JOIN event_result_sets ers ON ers.id = err.result_set_id
        WHERE ea.id = source_id
          AND is_event_results_manager(ers.event_id)
      )
    )
  );

DROP POLICY IF EXISTS "leaderboard_scores_delete_policy" ON leaderboard_scores;
CREATE POLICY "leaderboard_scores_delete_policy" ON leaderboard_scores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR (
      source_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM event_awards ea
        JOIN event_result_revisions err ON err.id = ea.revision_id
        JOIN event_result_sets ers ON ers.id = err.result_set_id
        WHERE ea.id = source_id
          AND is_event_results_manager(ers.event_id)
      )
    )
  );
