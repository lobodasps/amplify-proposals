import { beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

const { invokeLLMWithSkillMock } = vi.hoisted(() => ({
  invokeLLMWithSkillMock: vi.fn(),
}));

vi.mock("../_core/llmSkill", () => ({
  invokeLLMWithSkill: invokeLLMWithSkillMock,
  getSkillProvider: vi.fn().mockResolvedValue("google_gemini"),
}));

import { rfpSessionsRouter } from "./rfpSessions";

function createMinimalDocx(text: string): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),
  });
}

describe("rfpSessions.classifyFile DOCX handling", () => {
  beforeEach(() => {
    invokeLLMWithSkillMock.mockReset();
    invokeLLMWithSkillMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        documentType: "main_rfp_candidate",
        confidence: "high",
        keyEvidence: "Solicitation title and deadline",
        suggestedLabel: "Main solicitation",
        extractionDepth: "full",
        quickSignals: {
          agency: "City of Test",
          projectType: "Engineering",
          estimatedValue: "$500,000",
          dueDate: "2026-09-30",
          location: null,
          prequalRequired: false,
          prequalType: null,
          immediateRedFlags: [],
        },
      }) } }],
    });
  });

  it("extracts DOCX text before invoking the classifier and never passes a Word file_url attachment", async () => {
    const docx = createMinimalDocx("Proposal due September 30, 2026 for City of Test engineering services.");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(docx, { status: 200 })));
    const caller = rfpSessionsRouter.createCaller({
      user: { id: "11111111-1111-4111-8111-111111111111", role: "user" },
      req: {} as any,
      res: {} as any,
    } as any);

    await caller.classifyFile({
      fileUrl: "https://files.example.com/solicitation.docx",
      fileName: "Solicitation.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      isMainRfp: true,
    });

    const request = invokeLLMWithSkillMock.mock.calls[0][0];
    const content = request.messages[1].content as Array<{ type: string; text?: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("EXTRACTED DOCUMENT TEXT");
    expect(content[0].text).toContain("Proposal due September 30, 2026");
    expect(JSON.stringify(content)).not.toContain("file_url");
  });
});
