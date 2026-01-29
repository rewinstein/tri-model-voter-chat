"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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

const modelColors: Record<CandidateId, string> = {
  gpt: "bg-indigo-500",
  gemini: "bg-teal-500",
  claude: "bg-purple-500",
};

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ChatResponseBody | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, loading]);

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  const appendWinnerToConversation = (winnerText: string) => {
    setConversation((prev: ChatMessage[]) => [...prev, { role: "user", content: question.trim() }, { role: "assistant", content: winnerText }]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResults(null);

    // Optimistically update UI for better feel
    // setConversation((prev) => [...prev, { role: "user", content: question.trim() }]);
    // We defer this to keep logic simple with appendWinnerToConversation, 
    // but typically you'd show the user message immediately. 
    // Let's stick to the original logic flow to stay safe but style properly.

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
    setSettings((prev: Settings) => ({
      ...prev,
      ...partial,
      keys: { ...prev.keys, ...partial.keys },
      models: { ...prev.models, ...partial.models },
      temperatures: { ...prev.temperatures, ...partial.temperatures },
    }));
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col gap-8">

        {/* Header */}
        <header className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-6 animate-fade-in-down">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg transform rotate-3">
              <span className="text-white font-bold text-2xl">V</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--primary)]">System v1.0</p>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Tri-Model Voter</h1>
            </div>
          </div>
          <p className="hidden md:block text-sm text-[var(--muted-foreground)] max-w-md text-right leading-relaxed">
            Harnessing the collective intelligence of <span className="text-indigo-600 font-semibold">GPT</span>, <span className="text-teal-600 font-semibold">Gemini</span>, and <span className="text-purple-600 font-semibold">Claude</span>.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="glass-panel px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/60 transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
            >
              Settings
            </button>
            <button
              onClick={handleReset}
              className="bg-[var(--secondary)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-pink-600 transition-all duration-300 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 active:scale-95"
            >
              New Chat
            </button>
          </div>
        </header>

        {error && (
          <div className="glass border-l-4 border-red-500 p-4 rounded-xl text-red-600 font-medium">
            <SafeText text={error} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] min-h-[600px]">

          {/* Left Column: Chat */}
          <section className="glass rounded-[2.5rem] p-1 flex flex-col h-[75vh] lg:h-[800px] relative overflow-hidden ring-1 ring-white/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-50"></div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {conversation.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-tr from-blue-100 to-purple-100 flex items-center justify-center animate-pulse">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Debate</h3>
                  <p className="text-sm max-w-xs leading-relaxed text-[var(--muted-foreground)]">
                    Ask a question. Three AI models will answer, judge each other, and the best answer will win.
                  </p>
                </div>
              ) : (
                conversation.map((msg, idx) => (
                  <div
                    key={`${msg.role}-${idx}`}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-sm leading-relaxed ${msg.role === "user"
                          ? "bg-gradient-to-br from-[var(--primary)] to-blue-600 text-white rounded-tr-none"
                          : "bg-white/80 backdrop-blur-md border border-white/50 text-[var(--foreground)] rounded-tl-none"
                        }`}
                    >
                      <div className="mb-1 text-[10px] uppercase tracking-widest opacity-70 font-bold">
                        {msg.role === "user" ? "You" : "The Winner"}
                      </div>
                      <SafeText text={msg.content} className="whitespace-pre-wrap" />
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/40 backdrop-blur-lg border-t border-white/20">
              <div className="relative group">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  rows={1} // Start small, maybe auto-grow via CSS or just scroll for now
                  placeholder="Ask anything..."
                  className="w-full resize-none rounded-2xl border-none bg-white/70 py-4 pl-5 pr-32 text-sm shadow-inner focus:ring-2 focus:ring-[var(--primary)]/30 focus:bg-white transition-all outline-none"
                  style={{ minHeight: "3.5rem" }}
                />
                <div className="absolute right-2 bottom-1.5 top-1.5 flex items-center">
                  <button
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                    className="h-full px-6 rounded-xl bg-[var(--foreground)] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      </span>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] text-[var(--muted-foreground)] mt-3">
                API keys are stored locally.
              </p>
            </div>
          </section>

          {/* Right Column: Real-time Analysis */}
          <section className="flex flex-col gap-6">
            <div className="glass rounded-[2.5rem] p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold">Analysis Board</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">Live evaluation of model responses.</p>
                </div>
                {results && <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">Processing Complete</div>}
              </div>

              {!results ? (
                <div className="flex-1 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-[var(--muted)] p-8">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <span className="text-2xl grayscale">📊</span>
                  </div>
                  <p className="text-sm font-medium">Waiting for input...</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1">
                  {/* Winner Card */}
                  <div className="rounded-3xl p-[2px] bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-xl shadow-orange-500/10">
                    <div className="bg-white rounded-[22px] p-5 h-full relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-6xl rotate-12 pointer-events-none">
                        WINNER
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🏆</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
                          Winning Answer
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
                        {candidateLabels[results.winnerId]}
                      </h3>
                      <SafeText text={results.winnerText} className="text-sm text-slate-600 line-clamp-4 hover:line-clamp-none transition-all cursor-pointer" />
                    </div>
                  </div>

                  {/* Score Table */}
                  <ScoreTable judgeResults={results.judgeResults} totals={results.totals} />

                  {/* Candidate Details */}
                  <div className="space-y-4">
                    {results.candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className={`rounded-2xl p-4 transition-all duration-300 border ${candidate.id === results.winnerId
                            ? "bg-orange-50 border-orange-200 shadow-md transform scale-[1.01]"
                            : "bg-white/60 border-white/50 hover:bg-white"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${modelColors[candidate.id]}`}></div>
                            <span className="text-sm font-bold">{candidateLabels[candidate.id]}</span>
                          </div>
                          {candidate.id === results.winnerId && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">WINNER</span>}
                        </div>
                        <div className="text-xs text-slate-600">
                          {candidate.text ? (
                            <SafeText text={candidate.text} className="whitespace-pre-wrap max-h-32 overflow-hidden mask-fade-bottom" />
                          ) : (
                            <span className="text-red-500">{candidate.error ?? "No output"}</span>
                          )}
                        </div>
                        {/* Expand button could go here, but let's keep it simple with scroll/mask for now */}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
    <div className="glass-panel rounded-2xl p-4 overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Vote Breakdown</p>
      {judgeResults.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No judging data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 text-[var(--muted-foreground)]">
                <th className="py-2 pl-2">Judge</th>
                <th className="py-2 text-center text-indigo-600">GPT</th>
                <th className="py-2 text-center text-teal-600">Gemini</th>
                <th className="py-2 text-center text-purple-600">Claude</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {judgeOrder.map((judge) => {
                const result = judgeResults.find((r) => r.judge === judge);
                if (!result) return null;
                return (
                  <tr key={judge} className="hover:bg-white/30 transition-colors">
                    <td className="py-2.5 pl-2 font-medium">{candidateLabels[judge]}</td>
                    <td className="py-2.5 text-center font-mono">{result.scores.gpt}</td>
                    <td className="py-2.5 text-center font-mono">{result.scores.gemini}</td>
                    <td className="py-2.5 text-center font-mono">{result.scores.claude}</td>
                  </tr>
                );
              })}
              <tr className="bg-black/5 font-bold">
                <td className="py-3 pl-2">Total</td>
                <td className="py-3 text-center text-indigo-700">{totals.gpt.toFixed(1)}</td>
                <td className="py-3 text-center text-teal-700">{totals.gemini.toFixed(1)}</td>
                <td className="py-3 text-center text-purple-700">{totals.claude.toFixed(1)}</td>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass rounded-[2rem] p-8 shadow-2xl animate-zoom-in relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 transition-colors"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-1">Configuration</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">Manage API keys and model parameters.</p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Section 1: Keys */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-2">API Keys</h3>
            <InputGroup label="OpenAI Key" value={settings.keys.openai} onChange={(v) => onChange({ keys: { ...settings.keys, openai: v } })} type="password" placeholder="sk-..." />
            <InputGroup label="Gemini Key" value={settings.keys.gemini} onChange={(v) => onChange({ keys: { ...settings.keys, gemini: v } })} type="password" placeholder="AIza..." />
            <InputGroup label="Anthropic Key" value={settings.keys.anthropic} onChange={(v) => onChange({ keys: { ...settings.keys, anthropic: v } })} type="password" placeholder="sk-ant-..." />
          </div>

          {/* Section 2: Models & Temps */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-2">Models & Parameters</h3>
            <InputGroup label="OpenAI Model" value={settings.models.openai} onChange={(v) => onChange({ models: { ...settings.models, openai: v } })} />
            <InputGroup label="Gemini Model" value={settings.models.gemini} onChange={(v) => onChange({ models: { ...settings.models, gemini: v } })} />
            <InputGroup label="Claude Model" value={settings.models.anthropic} onChange={(v) => onChange({ models: { ...settings.models, anthropic: v } })} />

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-1">Gen Temp</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={settings.temperatures.generation}
                  onChange={(e) => onChange({ temperatures: { ...settings.temperatures, generation: parseFloat(e.target.value) } })}
                  className="w-full rounded-xl bg-white/50 border border-white/40 px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-1">Judge Temp</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={settings.temperatures.judging}
                  onChange={(e) => onChange({ temperatures: { ...settings.temperatures, judging: parseFloat(e.target.value) } })}
                  className="w-full rounded-xl bg-white/50 border border-white/40 px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center border-t border-black/5 pt-6">
          <button
            onClick={() => onChange(defaultSettings)}
            className="text-xs font-medium text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="bg-[var(--foreground)] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, type?: string }) {
  return (
    <div>
      <label className="block text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-1 pl-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-white/50 border border-white/40 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all shadow-sm placeholder:text-slate-400"
      />
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
