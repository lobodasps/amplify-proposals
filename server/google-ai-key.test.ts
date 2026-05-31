import { describe, it, expect } from "vitest";

describe("Google AI API Key validation", () => {
  it("should successfully call Gemini API with the provided key", async () => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    expect(apiKey).toBeTruthy();

    // Make a minimal request to the Gemini API to validate the key
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in one word." }] }],
        }),
      }
    );

    // If the key is valid, we get 200. If invalid, we get 400/401/403.
    console.log("Gemini API response status:", response.status);
    const body = await response.json();
    console.log("Gemini API response:", JSON.stringify(body).slice(0, 300));

    expect(response.status).toBe(200);
    expect(body.candidates).toBeDefined();
    expect(body.candidates.length).toBeGreaterThan(0);
  });
});
