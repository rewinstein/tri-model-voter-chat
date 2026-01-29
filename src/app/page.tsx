"use client";

import { useEffect, useMemo, useState } from "react";
import type { CandidateAnswer, CandidateId, ChatMessage, ChatResponseBody, JudgeResult } from "@/lib/types";
import { sanitizeText } from "@/lib/utils/text";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  anthropic: "claude-3-5-sonnet-20241022",
};

const STORAGE_KEY = "tri-model-voter-settings";

type Settings = {
  keys: {
    openai: string;
    gemini: string;
    anthropic: string;
  };
  models: typeof DEFAULT_MODELS;
  temperatures: {
    generation: number;
    judging: number;
  };
};

const defaultSettings: Settings = {
  keys: { openai: "", gemini: "", anthropic: "" },
  models: DEFAULT_MODELS,
  temperatures: { generation: 0.7, judging: 0.0 },
};

const candidateLabels: Record<CandidateId, string> = {
  gpt: "GPT",
  gemini: "Gemini",
  claude: "Claude",
};

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ChatResponseBody | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Settings;
        setSettings({
          ...defaultSettings,
          ...parsed,
          keys: { ...defaultSettings.keys, ...parsed.keys },
          models: { ...defaultSettings.models, ...parsed.models },
          temperatures: { ...defaultSettings.temperatures, ...parsed.temperatures },
        });
      } catch {
        setSettings(defaultSettings);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  const appendWinnerToConversation = (winnerText: string) => {
    setConversation((prev) => [...prev, { role: "user", content: question.trim() }, { role: "assistant", content: winnerText }]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation,
          question: question.trim(),
          keys: settings.keys,
          models: settings.models,
          temperatures: settings.temperatures,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Request failed.");
      }

      const data = (await res.json()) as ChatResponseBody;
      setResults(data);
      appendWinnerToConversation(data.winnerText);
      setQuestion("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConversation([]);
    setResults(null);
    setQuestion("");
    setError(null);
  };

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...partial,
      keys: { ...prev.keys, ...partial.keys },
      models: { ...prev.models, ...partial.models },
      temperatures: { ...prev.temperatures, ...partial.temperatures },
    }));
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">tri-model-voter-chat</p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">Tri-Model Voter Chat</h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
              Compare GPT, Gemini, and Claude answers. Each model judges all three, scores are aggregated, and the winning
              answer becomes the only assistant reply kept in the conversation.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5"
            >
              Settings
            </button>
            <button
              onClick={handleReset}
              className="rounded-full border border-black/10 bg-[var(--accent-2)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5"
            >
              Reset conversation
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <SafeText text={error} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-semibold">Chat history</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Only the winning assistant answers are stored in the conversation context.
            </p>

            <div className="mt-4 space-y-4">
              {conversation.length === 0 && (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Ask a question to start the conversation.
                </div>
              )}

              {conversation.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  <p className="text-xs uppercase tracking-widest opacity-70">{msg.role}</p>
                  <SafeText text={msg.content} className="mt-2 whitespace-pre-wrap" />
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                placeholder="Ask a question..."
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-black/20"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted)]">
                  Keys are stored locally in your browser and sent to server only for the current request.
                </p>
                <button
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Running..." : "Send"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-semibold">This turn results</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Scores from each judge and the selected winning answer.</p>

            {!results && (
              <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
                Results will appear after a question is submitted.
              </div>
            )}

            {results && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-black/10 bg-[var(--surface)] px-4 py-4">
                  <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Winning answer</p>
                  <h3 className="mt-2 text-base font-semibold text-[var(--accent-2)]">
                    {candidateLabels[results.winnerId]} selected
                  </h3>
                  <SafeText text={results.winnerText} className="mt-3 whitespace-pre-wrap text-sm" />
                </div>

                <ScoreTable judgeResults={results.judgeResults} totals={results.totals} />

                <div className="space-y-3">
                  {results.candidates.map((candidate) => (
                    <details
                      key={candidate.id}
                      className={`rounded-2xl border border-black/10 bg-white px-4 py-3 transition ${
                        candidate.id === results.winnerId ? "border-[var(--accent-2)]" : ""
                      }`}
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        {candidateLabels[candidate.id]} candidate {candidate.id === results.winnerId ? "(winner)" : ""}
                      </summary>
                      <div className="mt-3 text-sm">
                        {candidate.text ? (
                          <SafeText text={candidate.text} className="whitespace-pre-wrap" />
                        ) : (
                          <p className="text-red-600">{candidate.error ?? "Missing response"}</p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={updateSettings}
        />
      )}
    </div>
  );
}

function ScoreTable({
  judgeResults,
  totals,
}: {
  judgeResults: JudgeResult[];
  totals: Record<CandidateId, number>;
}) {
  const judgeOrder: CandidateId[] = ["gpt", "gemini", "claude"];
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Scoreboard</p>
      {judgeResults.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Judging skipped for this turn.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2">Judge</th>
                <th className="py-2">GPT</th>
                <th className="py-2">Gemini</th>
                <th className="py-2">Claude</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {judgeOrder.map((judge) => {
                const result = judgeResults.find((r) => r.judge === judge);
                if (!result) {
                  return (
                    <tr key={judge}>
                      <td className="py-2 font-semibold">{candidateLabels[judge]}</td>
                      <td className="py-2" colSpan={4}>
                        Missing judge result
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={judge} className="border-t border-black/5">
                    <td className="py-2 font-semibold">{candidateLabels[judge]}</td>
                    <td className="py-2">{result.scores.gpt}</td>
                    <td className="py-2">{result.scores.gemini}</td>
                    <td className="py-2">{result.scores.claude}</td>
                    <td className="py-2 text-[10px] text-[var(--muted)]">
                      {result.isFallback ? "Fallback" : ""}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-black/10 font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2">{totals.gpt.toFixed(1)}</td>
                <td className="py-2">{totals.gemini.toFixed(1)}</td>
                <td className="py-2">{totals.claude.toFixed(1)}</td>
                <td className="py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  onClose,
  onChange,
}: {
  settings: Settings;
  onClose: () => void;
  onChange: (partial: Partial<Settings>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Settings</p>
            <h2 className="text-xl font-semibold">API keys & models</h2>
          </div>
          <button onClick={onClose} className="text-sm text-[var(--muted)]">
            Close
          </button>
        </div>

        <p className="mt-3 text-xs text-[var(--muted)]">
          Keys are stored locally in your browser and sent to server only for the current request.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">OpenAI key</label>
            <input
              value={settings.keys.openai}
              onChange={(e) => onChange({ keys: { openai: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
              placeholder="sk-..."
              type="password"
            />
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">OpenAI model</label>
            <input
              value={settings.models.openai}
              onChange={(e) => onChange({ models: { openai: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Gemini key</label>
            <input
              value={settings.keys.gemini}
              onChange={(e) => onChange({ keys: { gemini: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
              placeholder="AIza..."
              type="password"
            />
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Gemini model</label>
            <input
              value={settings.models.gemini}
              onChange={(e) => onChange({ models: { gemini: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Anthropic key</label>
            <input
              value={settings.keys.anthropic}
              onChange={(e) => onChange({ keys: { anthropic: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
              placeholder="sk-ant-..."
              type="password"
            />
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Claude model</label>
            <input
              value={settings.models.anthropic}
              onChange={(e) => onChange({ models: { anthropic: e.target.value } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Generation temp</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={settings.temperatures.generation}
              onChange={(e) => onChange({ temperatures: { generation: Number(e.target.value) } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
            />
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Judging temp</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={settings.temperatures.judging}
              onChange={(e) => onChange({ temperatures: { judging: Number(e.target.value) } })}
              className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onChange(defaultSettings)}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold"
          >
            Reset settings
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SafeText({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeText(text) }}
    />
  );
}
