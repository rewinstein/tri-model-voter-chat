export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type CandidateId = "gpt" | "gemini" | "claude";

export interface CandidateAnswer {
  id: CandidateId;
  text: string | null;
  error?: string;
}

export interface JudgeResult {
  judge: CandidateId;
  scores: Record<CandidateId, number>;
  notes: Record<CandidateId, string>;
  isFallback?: boolean;
}

export interface ChatRequestBody {
  conversation: ChatMessage[];
  question: string;
  keys: {
    openai?: string;
    gemini?: string;
    anthropic?: string;
  };
  models: {
    openai: string;
    gemini: string;
    anthropic: string;
  };
  temperatures?: {
    generation?: number;
    judging?: number;
  };
}

export interface ChatResponseBody {
  candidates: CandidateAnswer[];
  judgeResults: JudgeResult[];
  totals: Record<CandidateId, number>;
  winnerId: CandidateId;
  winnerText: string;
  warnings?: string[];
}
