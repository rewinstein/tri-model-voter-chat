import { z } from "zod";
import type { CandidateId } from "@/lib/types";
import { extractJsonObject } from "@/lib/utils/text";

const scoreSchema = z
  .number()
  .min(0)
  .max(10);

const resultSchema = z.object({
  scores: z.object({
    gpt: scoreSchema,
    gemini: scoreSchema,
    claude: scoreSchema,
  }),
  notes: z.object({
    gpt: z.string(),
    gemini: z.string(),
    claude: z.string(),
  }),
});

export type ParsedJudgeResult = z.infer<typeof resultSchema>;

export function parseJudgeJson(text: string): ParsedJudgeResult | null {
  const jsonText = extractJsonObject(text) ?? text;
  try {
    const parsed = JSON.parse(jsonText);
    const result = resultSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(10, value));
}

export function emptyNotes(): Record<CandidateId, string> {
  return { gpt: "", gemini: "", claude: "" };
}
