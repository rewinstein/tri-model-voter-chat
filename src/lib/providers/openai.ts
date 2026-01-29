import OpenAI from "openai";
import type { CandidateAnswer, ChatMessage, JudgeResult } from "@/lib/types";
import { GENERATION_SYSTEM_PROMPT, buildGenerationPrompt, buildJudgingPrompt } from "@/lib/judging/prompts";
import { parseJudgeJson } from "@/lib/judging/validate";
import { fallbackScores } from "@/lib/judging/fallback";

const DEFAULT_MAX_TOKENS = 1024;

export async function generateAnswer(
  conversation: ChatMessage[],
  question: string,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const messages = [
    { role: "system" as const, content: GENERATION_SYSTEM_PROMPT },
    ...conversation,
    { role: "user" as const, content: question },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: DEFAULT_MAX_TOKENS,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function judgeAnswers(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  const client = new OpenAI({ apiKey });
  const run = async (retryOnlyJson: boolean) => {
    const prompt = buildJudgingPrompt(question, conversation, candidates, retryOnlyJson);
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: DEFAULT_MAX_TOKENS,
    });
    return completion.choices[0]?.message?.content ?? "";
  };

  let responseText = await run(false);
  let parsed = parseJudgeJson(responseText);
  if (!parsed) {
    responseText = await run(true);
    parsed = parseJudgeJson(responseText);
  }

  if (!parsed) {
    const fallback = fallbackScores(question, candidates);
    return { judge: "gpt", scores: fallback.scores, notes: fallback.notes, isFallback: true };
  }

  return { judge: "gpt", scores: parsed.scores, notes: parsed.notes };
}
