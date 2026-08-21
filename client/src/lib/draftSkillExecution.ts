export type DraftSkillExecutionResponse = {
  success: boolean;
  cached?: boolean;
  running?: boolean;
};

/**
 * Direct completed/cached calls already contain final output and must advance
 * immediately. Only work that outlives the bounded server wait needs polling.
 */
export function shouldPollForSkillCompletion(response: DraftSkillExecutionResponse): boolean {
  return response.success && !response.cached && response.running !== false;
}
