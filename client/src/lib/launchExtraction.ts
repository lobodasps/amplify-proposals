export interface LaunchExtractionFields {
  title?: string | null;
  agency?: string | null;
  submissionDeadline?: string | null;
  estimatedValue?: string | null;
}

const EMPTY_SOURCE_VALUES = new Set(["", "n/a", "na", "not specified", "unknown", "tbd"]);

function hasSourceValue(value: string | null | undefined): boolean {
  return Boolean(value && !EMPTY_SOURCE_VALUES.has(value.trim().toLowerCase()));
}

/** Returns user-facing labels for RFP fields that require manual review after extraction. */
export function getMissingCriticalRfpFields(fields: LaunchExtractionFields): string[] {
  const missing: string[] = [];
  if (!hasSourceValue(fields.title)) missing.push("Project / RFP title");
  if (!hasSourceValue(fields.agency)) missing.push("Agency / client");
  if (!hasSourceValue(fields.submissionDeadline)) missing.push("Submission deadline");
  if (!hasSourceValue(fields.estimatedValue)) missing.push("Estimated value");
  return missing;
}
