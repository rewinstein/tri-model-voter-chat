import type { CandidateAnswer, ChatMessage } from "@/lib/types";
import { formatConversation } from "@/lib/utils/text";

export const GENERATION_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer concisely but correctly. If uncertain, say so.";

export function buildGenerationPrompt(conversation: ChatMessage[], question: string): string {
  const convo = formatConversation(conversation);
  return [
    "Conversation so far:",
    convo,
    "",
    "User question:",
    question,
    "",
    "Provide the best possible answer.",
  ].join("\n");
}

export function buildJudgingPrompt(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  retryOnlyJson: boolean,
): string {
  const convo = formatConversation(conversation);
  const entries = candidates
    .map((c) => {
      if (!c.text) {
        return `${c.id.toUpperCase()} ANSWER: [MISSING - treat as score 0]`;
      }
      return `${c.id.toUpperCase()} ANSWER:\n${c.text}`;
    })
    .join("\n\n");

  const rubric = [
    "Score each answer from 0-10.",
    "Prioritize correctness and factuality.",
    "Assess completeness relative to the question.",
    "Consider clarity, structure, and usefulness.",
    "Penalize unsafe or disallowed content.",
    "Do not reveal chain-of-thought; keep reasons short.",
  ].join(" ");

  const base = [
    "You are an impartial evaluator.",
    rubric,
    "Return STRICT JSON only with this schema:",
    '{"scores":{"gpt":number,"gemini":number,"claude":number},"notes":{"gpt":"short reason","gemini":"short reason","claude":"short reason"}}',
    "",
    "Question:",
    question,
    "",
    "Conversation context:",
    convo,
    "",
    "Candidate answers:",
    entries,
  ];

  if (retryOnlyJson) {
    base.unshift("Return valid JSON only. No extra text.");
  }

  return base.join("\n");
}
