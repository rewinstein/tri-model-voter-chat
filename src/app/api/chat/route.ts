import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import type { CandidateAnswer, CandidateId, ChatRequestBody, JudgeResult } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { aggregateTotals, selectWinner } from "@/lib/judging/aggregate";
import { fallbackScores } from "@/lib/judging/fallback";
import {
  generateClaude,
  generateGemini,
  generateOpenAI,
  judgeWithClaude,
  judgeWithGemini,
  judgeWithOpenAI,
} from "@/lib/providers";

const requestSchema = z.object({
  conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  question: z.string().min(1),
  keys: z.object({
    openai: z.string().optional(),
    gemini: z.string().optional(),
    anthropic: z.string().optional(),
  }),
  models: z.object({
    openai: z.string().min(1),
    gemini: z.string().min(1),
    anthropic: z.string().min(1),
  }),
  temperatures: z
    .object({ generation: z.number().optional(), judging: z.number().optional() })
    .optional(),
});

async function getIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

function buildCandidate(id: CandidateId, text: string | null, error?: string): CandidateAnswer {
  return { id, text, error };
}

function fallbackJudge(judge: CandidateId, question: string, candidates: CandidateAnswer[]): JudgeResult {
  const fallback = fallbackScores(question, candidates);
  return { judge, scores: fallback.scores, notes: fallback.notes, isFallback: true };
}

function enforceMissingCandidateScores(result: JudgeResult, candidates: CandidateAnswer[]): JudgeResult {
  const missing = new Set(candidates.filter((c) => !c.text).map((c) => c.id));
  if (missing.size === 0) return result;
  const scores = { ...result.scores };
  const notes = { ...result.notes };
  for (const id of missing) {
    scores[id] = 0;
    notes[id] = notes[id] ? `${notes[id]} (missing)` : "missing candidate";
  }
  return { ...result, scores, notes };
}

export async function POST(req: Request) {
  const ip = await getIp();
  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait and try again." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } },
    );
  }

  let body: ChatRequestBody;
  try {
    const json = await req.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const generationTemp = body.temperatures?.generation ?? 0.7;
  const judgingTemp = body.temperatures?.judging ?? 0.0;

  const candidates: CandidateAnswer[] = [
    buildCandidate("gpt", null, "Missing API key"),
    buildCandidate("gemini", null, "Missing API key"),
    buildCandidate("claude", null, "Missing API key"),
  ];

  const generationPromises = [
    body.keys.openai
      ? generateOpenAI(body.conversation, body.question, body.keys.openai, body.models.openai, generationTemp)
      : Promise.reject(new Error("Missing OpenAI key")),
    body.keys.gemini
      ? generateGemini(body.conversation, body.question, body.keys.gemini, body.models.gemini, generationTemp)
      : Promise.reject(new Error("Missing Gemini key")),
    body.keys.anthropic
      ? generateClaude(body.conversation, body.question, body.keys.anthropic, body.models.anthropic, generationTemp)
      : Promise.reject(new Error("Missing Anthropic key")),
  ];

  const generationResults = await Promise.allSettled(generationPromises);

  const ids: CandidateId[] = ["gpt", "gemini", "claude"];
  generationResults.forEach((result, idx) => {
    const id = ids[idx];
    if (result.status === "fulfilled" && result.value.trim()) {
      candidates[idx] = buildCandidate(id, result.value.trim());
    } else {
      const reason = result.status === "rejected" ? result.reason?.message ?? "Generation failed" : "Empty response";
      candidates[idx] = buildCandidate(id, null, reason);
    }
  });

  const availableCandidates = candidates.filter((c) => !!c.text);
  if (availableCandidates.length === 0) {
    return NextResponse.json({ error: "All provider calls failed." }, { status: 502 });
  }

  const judgeResults: JudgeResult[] = [];

  if (availableCandidates.length === 1) {
    const winnerId = availableCandidates[0].id;
    return NextResponse.json({
      candidates,
      judgeResults,
      totals: { gpt: 0, gemini: 0, claude: 0 },
      winnerId,
      winnerText: availableCandidates[0].text,
      warnings: ["Only one candidate available; judging skipped."],
    });
  }

  const judgePromises = [
    body.keys.openai
      ? judgeWithOpenAI(body.question, body.conversation, candidates, body.keys.openai, body.models.openai, judgingTemp)
      : Promise.reject(new Error("Missing OpenAI key")),
    body.keys.gemini
      ? judgeWithGemini(body.question, body.conversation, candidates, body.keys.gemini, body.models.gemini, judgingTemp)
      : Promise.reject(new Error("Missing Gemini key")),
    body.keys.anthropic
      ? judgeWithClaude(body.question, body.conversation, candidates, body.keys.anthropic, body.models.anthropic, judgingTemp)
      : Promise.reject(new Error("Missing Anthropic key")),
  ];

  const judgeSettled = await Promise.allSettled(judgePromises);

  judgeSettled.forEach((result, idx) => {
    const judge = ids[idx];
    if (result.status === "fulfilled") {
      judgeResults.push(enforceMissingCandidateScores(result.value, candidates));
    } else {
      judgeResults.push(fallbackJudge(judge, body.question, candidates));
    }
  });

  const totals = aggregateTotals(judgeResults);
  const winnerId = selectWinner(candidates, judgeResults);
  const winnerText = candidates.find((c) => c.id === winnerId)?.text ?? availableCandidates[0].text ?? "";

  return NextResponse.json({
    candidates,
    judgeResults,
    totals,
    winnerId,
    winnerText,
  });
}
