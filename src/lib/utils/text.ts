import type { ChatMessage } from "@/lib/types";

export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatConversation(conversation: ChatMessage[]): string {
  if (conversation.length === 0) return "(no prior conversation)";
  return conversation
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

export function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}
