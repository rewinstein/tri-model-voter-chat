import type { CandidateAnswer, ChatMessage, JudgeResult } from "@/lib/types";
import * as openaiProvider from "@/lib/providers/openai";
import * as geminiProvider from "@/lib/providers/gemini";
import * as claudeProvider from "@/lib/providers/claude";

export async function generateOpenAI(
  conversation: ChatMessage[],
  question: string,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<string> {
  return openaiProvider.generateAnswer(conversation, question, apiKey, model, temperature);
}

export async function generateGemini(
  conversation: ChatMessage[],
  question: string,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<string> {
  return geminiProvider.generateAnswer(conversation, question, apiKey, model, temperature);
}

export async function generateClaude(
  conversation: ChatMessage[],
  question: string,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<string> {
  return claudeProvider.generateAnswer(conversation, question, apiKey, model, temperature);
}

export async function judgeWithOpenAI(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  return openaiProvider.judgeAnswers(question, conversation, candidates, apiKey, model, temperature);
}

export async function judgeWithGemini(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  return geminiProvider.judgeAnswers(question, conversation, candidates, apiKey, model, temperature);
}

export async function judgeWithClaude(
  question: string,
  conversation: ChatMessage[],
  candidates: CandidateAnswer[],
  apiKey: string,
  model: string,
  temperature: number,
): Promise<JudgeResult> {
  return claudeProvider.judgeAnswers(question, conversation, candidates, apiKey, model, temperature);
}
