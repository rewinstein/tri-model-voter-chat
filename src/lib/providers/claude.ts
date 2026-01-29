import Anthropic from "@anthropic-ai/sdk";
import type { CandidateAnswer, ChatMessage, JudgeResult } from "@/lib/types";
import { GENERATION_SYSTEM_PROMPT, buildJudgingPrompt } from "@/lib/judging/prompts";
import { parseJudgeJson } from "@/lib/judging/validate";
import { fallbackScores } from "@/lib/judging/fallback";

const DEFAULT_MAX_TOKENS = 1024;

function toAnthropicMessages(conversation: ChatMessage[], question?: string) {
  const messages = conversation.map((m) => ({ role: m.role, content: m.content }));
  if (question) {
    messages.push({ role: "user", content: question });
  }
  return messages;
}

export async function generateAnswer(
  conversation: ChatMessage[],
  question: string,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    system: GENERATION_SYSTEM_PROMPT,
    messages: toAnthropicMessages(conversation, question),
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature,
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return text.trim();
}

export async function judgeAnswers(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  const client = new Anthropic({ apiKey });

  const run = async (retryOnlyJson: boolean) => {
    const prompt = buildJudgingPrompt(question, conversation, candidates, retryOnlyJson);
    const response = await client.messages.create({
      model,
      system: "You are an impartial evaluator.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature,
    });
    return response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  };

  let responseText = await run(false);
  let parsed = parseJudgeJson(responseText);
  if (!parsed) {
    responseText = await run(true);
    parsed = parseJudgeJson(responseText);
  }

  if (!parsed) {
    const fallback = fallbackScores(question, candidates);
    return { judge: "claude", scores: fallback.scores, notes: fallback.notes, isFallback: true };
  }

  return { judge: "claude", scores: parsed.scores, notes: parsed.notes };
}
