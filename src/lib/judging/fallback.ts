import type { CandidateAnswer, CandidateId } from "@/lib/types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

function coverageScore(question: string, answer: string): number {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return 0;
  let hit = 0;
  for (const token of qTokens) {
    if (answer.toLowerCase().includes(token)) hit += 1;
  }
  return hit / qTokens.size;
}

function safetyScore(answer: string): number {
  const unsafe = ["kill", "suicide", "self-harm", "bomb", "terror", "sexual", "abuse"];
  const lower = answer.toLowerCase();
  for (const word of unsafe) {
    if (lower.includes(word)) return 0.2;
  }
  return 1;
}

export function fallbackScores(question: string, candidates: CandidateAnswer[]) {
  const scores: Record<CandidateId, number> = { gpt: 0, gemini: 0, claude: 0 };
  const notes: Record<CandidateId, string> = { gpt: "fallback scoring", gemini: "fallback scoring", claude: "fallback scoring" };

  for (const candidate of candidates) {
    if (!candidate.text) {
      scores[candidate.id] = 0;
      notes[candidate.id] = "missing candidate";
      continue;
    }
    const coverage = coverageScore(question, candidate.text);
    const lengthNorm = Math.min(candidate.text.length / 800, 1);
    const safety = safetyScore(candidate.text);
    const raw = 10 * (0.6 * coverage + 0.3 * lengthNorm + 0.1 * safety);
    scores[candidate.id] = Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
  }

  return { scores, notes };
}
