export type LaunchStage = "upload" | "classify" | "extract" | "review" | "go_no_go" | "complete";
export type LaunchStageStatus = "ready" | "running" | "complete" | "failed";

export interface LaunchReviewData {
  title: string;
  agency: string;
  rfpNumber: string;
  submissionDeadline: string;
  estimatedValue: string;
  serviceLines: string[];
  scopeSummary: string;
}

export interface LaunchStageEvent {
  stage: LaunchStage;
  status: LaunchStageStatus;
  occurredAt: number;
  message?: string;
}

export interface LaunchGoNoGoState {
  status: LaunchStageStatus;
  inputHash?: string;
  result?: Record<string, unknown>;
  provider?: string;
  model?: string;
  error?: string;
  completedAt?: number;
}

export interface LaunchState {
  version: 1;
  currentStage: LaunchStage;
  stageStatus: Partial<Record<LaunchStage, LaunchStageStatus>>;
  retryCounts: Partial<Record<LaunchStage, number>>;
  review?: LaunchReviewData;
  goNoGo?: LaunchGoNoGoState;
  events: LaunchStageEvent[];
  updatedAt: number;
}

export type LaunchRestoreTarget = "processing" | "review" | "decision";

export function emptyLaunchState(): LaunchState {
  return {
    version: 1,
    currentStage: "upload",
    stageStatus: { upload: "ready" },
    retryCounts: {},
    events: [],
    updatedAt: Date.now(),
  };
}

export function readLaunchState(value: unknown): LaunchState {
  if (!value || typeof value !== "object") return emptyLaunchState();
  const candidate = value as Partial<LaunchState>;
  return {
    ...emptyLaunchState(),
    ...candidate,
    version: 1,
    stageStatus: candidate.stageStatus ?? {},
    retryCounts: candidate.retryCounts ?? {},
    events: Array.isArray(candidate.events) ? candidate.events.slice(-100) : [],
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}

export function recordLaunchStage(
  current: unknown,
  stage: LaunchStage,
  status: LaunchStageStatus,
  message?: string,
): LaunchState {
  const state = readLaunchState(current);
  const event: LaunchStageEvent = { stage, status, occurredAt: Date.now(), ...(message ? { message } : {}) };
  return {
    ...state,
    currentStage: status === "complete" && stage === "extract" ? "review" : stage,
    stageStatus: { ...state.stageStatus, [stage]: status },
    events: [...state.events, event].slice(-100),
    updatedAt: Date.now(),
  };
}

/** Determines the furthest safe UI step without ever restarting completed work. */
export function resolveLaunchRestoreTarget(
  stateValue: unknown,
  parserStatus?: string,
): LaunchRestoreTarget {
  const state = readLaunchState(stateValue);
  if (state.goNoGo?.status === "complete" && state.goNoGo.result) return "decision";
  if (parserStatus === "running" || state.stageStatus.extract === "running") return "processing";
  return "review";
}

/** Stable FNV-1a hash; this is an idempotency identity, not a security primitive. */
export function buildGoNoGoInputHash(review: LaunchReviewData): string {
  const canonical = JSON.stringify({
    title: review.title.trim(),
    agency: review.agency.trim(),
    rfpNumber: review.rfpNumber.trim(),
    submissionDeadline: review.submissionDeadline.trim(),
    estimatedValue: review.estimatedValue.trim(),
    serviceLines: [...review.serviceLines].map((value) => value.trim()).filter(Boolean).sort(),
    scopeSummary: review.scopeSummary.trim(),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `gng_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
