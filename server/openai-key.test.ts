import { describe, it, expect } from "vitest";

describe("OpenAI API Key validation", () => {
  it("should successfully call OpenAI API with the provided key", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say hello in one word." }],
        max_tokens: 5,
      }),
    });

    console.log("OpenAI API response status:", response.status);
    const body = await response.json();
    console.log("OpenAI API response:", JSON.stringify(body).slice(0, 300));

    // 200 = success; 429 = rate-limited (key is valid but quota exceeded — still a pass)
    // 401 = invalid key (fail)
    expect([200, 429]).toContain(response.status);
    if (response.status === 200) {
      expect(body.choices).toBeDefined();
      expect(body.choices.length).toBeGreaterThan(0);
    }
  });
});
