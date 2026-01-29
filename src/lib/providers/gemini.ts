import { GoogleGenerativeAI } from "@google/generative-ai";
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
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = [GENERATION_SYSTEM_PROMPT, "", buildGenerationPrompt(conversation, question)].join("\n");
  const generativeModel = genAI.getGenerativeModel({
    model,
    generationConfig: { temperature, maxOutputTokens: DEFAULT_MAX_TOKENS },
  });
  const result = await generativeModel.generateContent(prompt);
  return result.response.text().trim();
}

export async function judgeAnswers(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    generationConfig: { temperature, maxOutputTokens: DEFAULT_MAX_TOKENS },
  });

  const run = async (retryOnlyJson: boolean) => {
    const prompt = buildJudgingPrompt(question, conversation, candidates, retryOnlyJson);
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
  };

  let responseText = await run(false);
  let parsed = parseJudgeJson(responseText);
  if (!parsed) {
    responseText = await run(true);
    parsed = parseJudgeJson(responseText);
  }

  if (!parsed) {
    const fallback = fallbackScores(question, candidates);
    return { judge: "gemini", scores: fallback.scores, notes: fallback.notes, isFallback: true };
  }

  return { judge: "gemini", scores: parsed.scores, notes: parsed.notes };
}
