import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, invokeSkillMock } = vi.hoisted(() => ({ getDbMock: vi.fn(), invokeSkillMock: vi.fn() }));

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../_core/llmSkill", () => ({
  invokeLLMWithSkill: invokeSkillMock,
  getSkillProvider: vi.fn().mockResolvedValue("google_gemini"),
}));

import { rfpSessionsRouter } from "./rfpSessions";
import { resolveLaunchRestoreTarget } from "../../shared/launchWorkflow";

const sessionId = "11111111-1111-4111-8111-111111111111";
const review = {
  title: "Bridge Condition Assessment",
  agency: "City DOT",
  rfpNumber: "RFP-42",
  submissionDeadline: "2026-10-01",
  estimatedValue: "$500,000",
  serviceLines: ["Construction Management"],
  scopeSummary: "Inspect and assess bridge conditions.",
};

function inMemorySessionDb(sessionRef: { current: Record<string, unknown> }) {
  const selection = {
    where: () => selection,
    limit: async () => [sessionRef.current],
  };
  return {
    select: () => ({
      from: () => selection,
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          sessionRef.current = { ...sessionRef.current, ...patch };
          return [];
        },
      }),
    }),
    insert: () => ({
      values: async () => [],
    }),
  };
}

describe("rfpSessions resumable Launch state", () => {
  let sessionRef: { current: Record<string, unknown> };

  beforeEach(() => {
    invokeSkillMock.mockReset();
    sessionRef = {
      current: {
        id: sessionId,
        extractedData: review,
        uploadedFiles: [{ name: "RFP.docx", url: "https://files.example.com/rfp.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Main RFP" }],
        workflowState: { rfp_parser: { status: "running" } },
        launchState: null,
      },
    };
    getDbMock.mockResolvedValue(inMemorySessionDb(sessionRef));
  });

  it("restores a running session, persists review, reuses a score, retries an isolated failure, and re-extracts without re-uploading", async () => {
    const caller = rfpSessionsRouter.createCaller({
      user: { id: "22222222-2222-4222-8222-222222222222", role: "user" },
      req: {} as any,
      res: {} as any,
    } as any);

    const runningSession = await caller.getLaunchState({ sessionId });
    expect(resolveLaunchRestoreTarget(runningSession?.launchState, "running")).toBe("processing");
    expect(runningSession?.uploadedFiles).toMatchObject([{ name: "RFP.docx" }]);

    sessionRef.current.workflowState = { rfp_parser: { status: "complete" } };
    const savedReview = await caller.saveLaunchReview({ sessionId, review });
    expect(savedReview.reusedResult).toBe(false);

    const savedScore = await caller.saveLaunchGoNoGo({
      sessionId,
      review,
      result: { score: 82, recommendation: "go" },
      provider: "google_gemini",
      model: "gemini-2.5-flash",
    });
    expect(savedScore.cached).toBe(false);

    const reusedScore = await caller.saveLaunchGoNoGo({
      sessionId,
      review,
      result: { score: 70 },
    });
    expect(reusedScore.cached).toBe(true);
    expect(reusedScore.result).toMatchObject({ score: 82 });

    await caller.markLaunchGoNoGoFailed({ sessionId, error: "Provider temporarily unavailable" });
    expect((sessionRef.current.launchState as any).retryCounts.go_no_go).toBe(1);
    expect((sessionRef.current.launchState as any).goNoGo.status).toBe("failed");

    await caller.prepareLaunchReextract({ sessionId });
    expect((sessionRef.current.launchState as any).stageStatus.extract).toBe("running");
    expect((sessionRef.current.launchState as any).retryCounts.extract).toBe(1);
    expect((sessionRef.current.launchState as any).goNoGo.status).toBe("ready");

    const restored = await caller.getLaunchState({ sessionId });
    expect(restored?.uploadedFiles).toHaveLength(1);
    expect(restored?.uploadedFiles).toMatchObject([{ url: "https://files.example.com/rfp.docx" }]);
    expect(restored?.launchState.review).toMatchObject({ title: review.title });
    expect(resolveLaunchRestoreTarget(restored?.launchState, "running")).toBe("processing");
  });

  it("rejects an evidence-dependent skill before LLM execution when the pursuit has no writer-approved assets", async () => {
    const session = {
      id: sessionId,
      pursuitId: "33333333-3333-4333-8333-333333333333",
      workflowState: {},
      skillOutputs: {},
    };
    let selectCount = 0;
    getDbMock.mockResolvedValue({
      select: () => {
        const call = selectCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => call === 0
                ? [session]
                : [{ selectedProjectIds: [], selectedPastProposalIds: [], selectedPersonnel: [] }],
            }),
          }),
        };
      },
    });
    const caller = rfpSessionsRouter.createCaller({
      user: { id: "22222222-2222-4222-8222-222222222222", role: "user" },
      req: {} as any,
      res: {} as any,
    } as any);

    await expect(caller.executeSkill({ sessionId, skillName: "key_personnel" }))
      .rejects.toThrow("Writer approval required");
  });

  it("retries only a failed proposal scorer and preserves all completed upstream outputs", async () => {
    const upstreamOutputs = {
      rfp_parser: "Parsed RFP scope",
      win_themes: "Win themes",
      technical_outline: "Technical outline",
      technical_writer: "Technical approach",
      key_personnel: "Key personnel",
      past_performance: "Past performance",
      fee_estimator: "Fee estimate",
    };
    sessionRef.current = {
      id: sessionId,
      pursuitId: null,
      extractedData: { evaluationCriteria: [{ id: "EC1", title: "Technical", weight: "100%", description: "Address scope" }] },
      skillOutputs: upstreamOutputs,
      workflowState: {
        ...Object.fromEntries(Object.keys(upstreamOutputs).map((key) => [key, { status: "complete" }])),
        proposal_scorer: { status: "error", errorMessage: "fetch failed" },
      },
    };
    getDbMock.mockResolvedValue(inMemorySessionDb(sessionRef));
    invokeSkillMock.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: JSON.stringify({ overallScore: 81, criteriaScores: [], gaps: [] }) } }],
      _provider: "anthropic",
      _model: "claude-sonnet-5",
    });
    const caller = rfpSessionsRouter.createCaller({
      user: { id: "22222222-2222-4222-8222-222222222222", role: "user" },
      req: {} as any,
      res: {} as any,
    } as any);

    await caller.executeSkill({ sessionId, skillName: "proposal_scorer", force: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(invokeSkillMock).toHaveBeenCalledWith(expect.objectContaining({ skillType: "proposal_scorer" }));
    expect((sessionRef.current.skillOutputs as Record<string, string>).proposal_scorer).toContain("overallScore");
    expect(sessionRef.current.skillOutputs).toMatchObject(upstreamOutputs);
    expect((sessionRef.current.workflowState as Record<string, { status: string }>).proposal_scorer.status).toBe("complete");
  });
});
