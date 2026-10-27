/**
 * Centralized, Versioned Competition Scoring Policy for NST Events
 *
 * Implements authoritative point allocation for event awards:
 * - 1st Place: 3 points
 * - 2nd Place: 2 points
 * - 3rd Place: 1 point
 * - Other placements or custom/special awards: 0 points (unless explicitly configured)
 *
 * Team results distribution rule:
 * - Each verified registered member of a winning team receives the configured placement points
 *   so that individual students receive leaderboard credit for their collective achievement.
 */

export interface ScoringPolicyConfig {
  policyVersion: number;
  placementPoints: Record<number, number>;
  defaultUnconfiguredPoints: number;
}

export const CURRENT_SCORING_POLICY: ScoringPolicyConfig = {
  policyVersion: 1,
  placementPoints: {
    1: 3,
    2: 2,
    3: 1,
  },
  defaultUnconfiguredPoints: 0,
};

/**
 * Calculates the leaderboard points for a specific award
 */
export function calculateAwardPoints(
  awardType: string,
  placement?: number | null,
  policy: ScoringPolicyConfig = CURRENT_SCORING_POLICY
): number {
  if (awardType !== 'RANKED_PLACEMENT' || !placement || placement <= 0) {
    return policy.defaultUnconfiguredPoints;
  }

  return policy.placementPoints[placement] ?? policy.defaultUnconfiguredPoints;
}
