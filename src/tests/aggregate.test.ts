import { describe, expect, it } from "vitest";
import { aggregateTotals, selectWinner } from "../lib/judging/aggregate";
import type { CandidateAnswer, JudgeResult } from "../lib/types";

const candidates: CandidateAnswer[] = [
  { id: "gpt", text: "A" },
  { id: "gemini", text: "B" },
  { id: "claude", text: "C" },
];

function makeJudge(judge: "gpt" | "gemini" | "claude", scores: Record<"gpt" | "gemini" | "claude", number>): JudgeResult {
  return { judge, scores, notes: { gpt: "", gemini: "", claude: "" } };
}

describe("aggregateTotals", () => {
  it("sums totals across judges", () => {
    const results = [
      makeJudge("gpt", { gpt: 7, gemini: 5, claude: 6 }),
      makeJudge("gemini", { gpt: 6, gemini: 7, claude: 5 }),
    ];
    const totals = aggregateTotals(results);
    expect(totals.gpt).toBe(13);
    expect(totals.gemini).toBe(12);
    expect(totals.claude).toBe(11);
  });
});

describe("selectWinner", () => {
  it("uses total score first", () => {
    const results = [
      makeJudge("gpt", { gpt: 9, gemini: 4, claude: 4 }),
      makeJudge("gemini", { gpt: 8, gemini: 5, claude: 5 }),
    ];
    expect(selectWinner(candidates, results)).toBe("gpt");
  });

  it("uses median as tie-breaker", () => {
    const results = [
      makeJudge("gpt", { gpt: 7, gemini: 7, claude: 7 }),
      makeJudge("gemini", { gpt: 6, gemini: 8, claude: 6 }),
      makeJudge("claude", { gpt: 8, gemini: 6, claude: 8 }),
    ];
    expect(selectWinner(candidates, results)).toBe("gpt");
  });

  it("uses self-judge as tie-breaker", () => {
    const results = [
      makeJudge("gpt", { gpt: 8, gemini: 8, claude: 8 }),
      makeJudge("gemini", { gpt: 7, gemini: 7, claude: 7 }),
      makeJudge("claude", { gpt: 7, gemini: 7, claude: 7 }),
    ];
    expect(selectWinner(candidates, results)).toBe("gpt");
  });
});
