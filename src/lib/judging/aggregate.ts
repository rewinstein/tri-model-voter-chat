import type { CandidateAnswer, CandidateId, JudgeResult } from "@/lib/types";

export function aggregateTotals(judgeResults: JudgeResult[]): Record<CandidateId, number> {
  const totals: Record<CandidateId, number> = { gpt: 0, gemini: 0, claude: 0 };
  for (const result of judgeResults) {
    totals.gpt += result.scores.gpt ?? 0;
    totals.gemini += result.scores.gemini ?? 0;
    totals.claude += result.scores.claude ?? 0;
  }
  return totals;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid] ?? 0;
}

function candidateExists(candidates: CandidateAnswer[], id: CandidateId): boolean {
  return candidates.some((c) => c.id === id && !!c.text);
}

export function selectWinner(
  candidates: CandidateAnswer[],
  judgeResults: JudgeResult[],
): CandidateId {
  const totals = aggregateTotals(judgeResults);
  const ids: CandidateId[] = ["gpt", "gemini", "claude"];

  const available = ids.filter((id) => candidateExists(candidates, id));
  if (available.length === 1) return available[0];

  const maxTotal = Math.max(...available.map((id) => totals[id]));
  let tied = available.filter((id) => totals[id] === maxTotal);
  if (tied.length === 1) return tied[0];

  const medianScores: Record<CandidateId, number> = { gpt: 0, gemini: 0, claude: 0 };
  for (const id of tied) {
    const scores = judgeResults.map((j) => j.scores[id] ?? 0);
    medianScores[id] = median(scores);
  }
  const maxMedian = Math.max(...tied.map((id) => medianScores[id]));
  tied = tied.filter((id) => medianScores[id] === maxMedian);
  if (tied.length === 1) return tied[0];

  const selfJudgeScores: Record<CandidateId, number> = { gpt: 0, gemini: 0, claude: 0 };
  for (const id of tied) {
    const judge = judgeResults.find((j) => j.judge === id);
    selfJudgeScores[id] = judge?.scores[id] ?? 0;
  }
  const maxSelf = Math.max(...tied.map((id) => selfJudgeScores[id]));
  tied = tied.filter((id) => selfJudgeScores[id] === maxSelf);
  if (tied.length === 1) return tied[0];

  return "gpt";
}
