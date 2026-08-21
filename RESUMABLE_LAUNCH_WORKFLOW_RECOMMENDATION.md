# Resumable Launch Workflow Recommendation

## Decision

> **A failure in Go/No-Go must never require repeating upload, text extraction, classification, or RFP shredding.** Those completed steps already produce durable artifacts and should be treated as an immutable checkpoint for the later decision stage.

The current Launch workflow should be refactored from a single, browser-local wizard into a **resumable session workflow**. The existing `rfpSessions` row, uploaded file manifest, extracted data, and parsed RFP output provide most of the persistence needed; the remaining work is to make stage completion explicit and to reload that state when the user returns.

| Stage | Persisted artifact | Retry rule | Token behavior |
|---|---|---|---|
| Upload | Uploaded file keys and manifest | Retry only failed upload | No AI tokens |
| Classification | Per-file labels, type, and quick signals | Retry only selected file | Small-model tokens only |
| Full extraction | Raw extracted text, XML/structured output, parsed RFP fields | Do not repeat unless user explicitly requests re-extraction | Preserve the expensive step |
| Review | User-edited title, agency, dates, value, service lines, and summary | Auto-save edits | No AI tokens |
| Go/No-Go | Input fingerprint, request status, model/provider, output/error | Retry this stage only | One scoring call per intentional retry |

## Recommended state model

The `rfp_sessions` record should own the workflow state. Add a structured `launchState` JSON object rather than relying only on browser component state. It should include a version, current stage, completed stages, per-stage status, timestamps, retry counts, and recoverable error summaries. The parsed opportunity fields should remain in `parsedRfp` (or the existing extracted-data structure), while the Go/No-Go response should be stored as a separate `goNoGoResult` payload.

```ts
type LaunchStage = "upload" | "classify" | "extract" | "review" | "go_no_go" | "complete";

interface LaunchState {
  version: 1;
  currentStage: LaunchStage;
  completedStages: LaunchStage[];
  stageStatus: Partial<Record<LaunchStage, "ready" | "running" | "complete" | "failed">>;
  retryCounts: Partial<Record<LaunchStage, number>>;
  errors: Partial<Record<LaunchStage, { message: string; occurredAt: number }>>;
  goNoGoInputHash?: string;
  updatedAt: number;
}
```

The **input hash** should be derived from the reviewed fields used in scoring: title, agency, service lines, estimated value, due date, and summary. This makes a completed Go/No-Go response reusable while clearly marking it stale if the user materially edits those inputs.

## User experience changes

The Launchpad should route users to `/launch?session=<rfpSessionId>` after the first session is created. On load, it should retrieve the session and restore the furthest completed stage. If extraction succeeded and Go/No-Go failed, the user should see the complete extracted-review form plus a clear **Retry Go/No-Go** button. There should be no upload prompt and no reprocessing spinner.

| Scenario | User sees | Available action |
|---|---|---|
| Extraction succeeded; Go/No-Go failed | “Extraction saved. Analysis did not complete.” | **Retry Go/No-Go** |
| Go/No-Go succeeded; fields unchanged | Existing decision result | **View result** or **Run again** |
| User edits scoring inputs after a result | “Analysis needs refresh” badge | **Re-run Go/No-Go** only |
| A single file failed classification | File-level warning in manifest | **Retry this file** or relabel manually |
| User explicitly wants fresh extraction | Extraction checkpoint shown | **Re-extract package** with token/cost confirmation |

## API and idempotency boundary

Introduce small stage-specific procedures rather than one monolithic processing action. The important rule is that each procedure can be called safely more than once.

| Procedure | Responsibility | Idempotency behavior |
|---|---|---|
| `rfpSessions.getLaunchState` | Load files, parsed fields, stage state, and prior scoring | Read-only |
| `rfpSessions.saveLaunchReview` | Persist reviewer edits | Last-write-wins with `updatedAt` |
| `rfpSessions.runGoNoGo` | Score only persisted review fields | Reuse successful result for same input hash unless `force: true` |
| `rfpSessions.retryStage` | Retry `classify` or `go_no_go` only | Increments that stage’s retry counter |
| `rfpSessions.reextract` | Explicitly rerun expensive full extraction | Requires confirmation and records a new extraction attempt |

The Go/No-Go call should use an **idempotency key** of `sessionId + goNoGoInputHash`. A temporary provider failure should leave the session at `review` with a failed Go/No-Go stage, not reset it to upload. Provider, model, duration, token usage, and the raw normalized response should be saved in the existing usage logs and the session result metadata.

## Retry policy

Provider errors should be classified before retrying. Rate limits and temporary service failures can retry automatically with bounded backoff; authorization, forbidden, malformed-request, and unsupported-model errors should switch provider or return an immediate actionable error. A user retry should always rerun only the affected stage.

| Failure class | Automatic behavior | User behavior |
|---|---|---|
| 429, 502, 503 | Bounded retry with backoff | Show progress and Cancel |
| 401, 403 | Try permitted configured fallback once | Show provider/model used or Settings guidance |
| 400, unsupported MIME/model | Do not retry same request | Preserve checkpoint; show corrective action |
| Invalid structured output | Repair/normalize once, then fail the stage only | Retry Go/No-Go without re-extracting |

## Implementation sequence

**Phase A — checkpoint and recovery** should be implemented first. Persist `launchState`, review fields, and Go/No-Go result; restore the session by URL; add **Retry Go/No-Go**. This alone solves the token-waste problem.

**Phase B — idempotency and cost controls** should add input hashes, reuse of same-input results, explicit stale indicators, and a user-confirmed **Re-extract package** action.

**Phase C — operational resilience** should add stage-level retry counters, a retry history, cancellation, provider failure telemetry, and an admin view of failed sessions.

## Acceptance criteria

The feature is complete when a user can upload and shred an RFP, experience a Go/No-Go failure, refresh or return later, and retry only Go/No-Go with the same extracted RFP fields and file manifest. No file upload, classification, or full extraction should run again unless the user explicitly chooses **Re-extract package**. The session must survive browser refresh, route navigation, and a recoverable provider error.
