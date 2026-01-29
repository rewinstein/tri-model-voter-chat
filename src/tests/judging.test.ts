import { describe, expect, it } from "vitest";
import { parseJudgeJson } from "../lib/judging/validate";
import { fallbackScores } from "../lib/judging/fallback";
import type { CandidateAnswer } from "../lib/types";

describe("parseJudgeJson", () => {
  it("parses valid JSON", () => {
    const json = JSON.stringify({
      scores: { gpt: 7, gemini: 6, claude: 8 },
      notes: { gpt: "ok", gemini: "ok", claude: "ok" },
    });
    const parsed = parseJudgeJson(json);
    expect(parsed?.scores.gpt).toBe(7);
  });

  it("extracts JSON embedded in text", () => {
    const text = `Here is the result: {"scores":{"gpt":5,"gemini":4,"claude":3},"notes":{"gpt":"a","gemini":"b","claude":"c"}} Thanks`;
    const parsed = parseJudgeJson(text);
    expect(parsed?.scores.claude).toBe(3);
  });

  it("returns null for invalid JSON", () => {
    const parsed = parseJudgeJson("not json");
    expect(parsed).toBeNull();
  });
});

describe("fallbackScores", () => {
  it("scores missing candidates as zero", () => {
    const candidates: CandidateAnswer[] = [
      { id: "gpt", text: null },
      { id: "gemini", text: "Answer" },
      { id: "claude", text: null },
    ];
    const result = fallbackScores("What is AI?", candidates);
    expect(result.scores.gpt).toBe(0);
    expect(result.scores.claude).toBe(0);
    expect(result.scores.gemini).toBeGreaterThan(0);
  });
});
