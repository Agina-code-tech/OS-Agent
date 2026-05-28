import React, { useEffect, useMemo, useState } from "react";
import { SectionCard } from "./components/SectionCard.jsx";
import {
  buildHistorySummary,
  formatGuideText,
  getLocalDateValue,
} from "./lib/astrology.js";

const HISTORY_KEY = "daily-astrology-history-v1";
const initialHistory = loadHistory();

function loadHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function upsertHistory(history, entry) {
  const next = history.filter((item) => item.id !== entry.id);
  return [entry, ...next].slice(0, 30);
}

function formatGeneratedAt(value) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPreview(guide) {
  return [guide.snapshot, guide.dominantMode.label, buildHistorySummary(guide)].join(" | ");
}

function MascotMark() {
  return (
    <svg
      className="mascot-mark"
      viewBox="0 0 160 160"
      role="img"
      aria-label="Cute cosmic mascot"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFFDD0" stopOpacity="1" />
          <stop offset="58%" stopColor="#F7CD91" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7B4DFF" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id="shadow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#4A2E74" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#1B0E2E" stopOpacity="0.85" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="58" fill="url(#glow)" />
      <circle cx="80" cy="80" r="44" fill="url(#shadow)" />
      <circle cx="66" cy="74" r="6" fill="#FFFDD0" />
      <circle cx="94" cy="74" r="6" fill="#FFFDD0" />
      <path
        d="M63 92c6 8 28 8 34 0"
        fill="none"
        stroke="#FFFDD0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M80 18l5 13 13 5-13 5-5 13-5-13-13-5 13-5z"
        fill="#FFFDD0"
        opacity="0.9"
      />
      <circle cx="118" cy="50" r="4" fill="#FFFDD0" opacity="0.85" />
      <circle cx="42" cy="116" r="5" fill="#FFFDD0" opacity="0.6" />
    </svg>
  );
}

export default function App() {
  const [date, setDate] = useState(() => getLocalDateValue());
  const [history, setHistory] = useState(() => initialHistory);
  const [selectedId, setSelectedId] = useState(() => initialHistory[0]?.id ?? null);
  const [currentEntry, setCurrentEntry] = useState(() => initialHistory[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    const selected = history.find((item) => item.id === selectedId) ?? history[0] ?? null;
    if (!selected && history.length === 0) return;
    setCurrentEntry(selected);
  }, [history, selectedId]);

  useEffect(() => {
    const today = getLocalDateValue();
    const hasToday = history.some((entry) => entry.id === today);

    if (!hasToday) {
      void generateGuide(today, { auto: true });
    }
  }, []);

  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedId) ?? currentEntry,
    [history, selectedId, currentEntry],
  );

  async function generateGuide(targetDate, { auto = false } = {}) {
    setLoading(true);
    setError("");
    setStatus(auto ? "Generating today's guide..." : "Generating guide...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: targetDate }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error || "Generation failed.");
      }

      setDate(targetDate);
      setHistory((previous) => upsertHistory(previous, payload.entry));
      setSelectedId(payload.entry.id);
      setCurrentEntry(payload.entry);
      setStatus(
        payload.fallback
          ? "Generated with fallback logic because the LLM request failed."
          : `Generated with ${payload.entry.model || "the model"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate guide.");
      setStatus("Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyGuide() {
    if (!selectedHistory) return;

    try {
      await navigator.clipboard.writeText(formatGuideText(selectedHistory.guide));
      setStatus("Copied the current guide.");
    } catch {
      setStatus("Copy failed in this browser context.");
    }
  }

  function clearHistory() {
    setHistory([]);
    setCurrentEntry(null);
    setSelectedId(null);
    setStatus("History cleared.");
  }

  const guide = selectedHistory?.guide;

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero-shell">
        <div className="hero-copy">
          <MascotMark />
          <p className="eyebrow centered">Daily Astrology OS</p>
          <h1>LLM-backed daily guidance with saved history.</h1>
          <p className="hero-subtitle">
            A practical daily operating system that turns a date into centered, usable direction.
          </p>
          <p className="hero-subtext">
            Pick a day, generate a reading, save it locally, and copy the full guide whenever you need it.
          </p>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="control-panel panel">
          <div className="control-row">
            <label className="field">
              <span>Date selector</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            <div className="button-stack">
              <button type="button" onClick={() => generateGuide(date)} disabled={loading}>
                {loading ? "Generating..." : "Generate guide"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const today = getLocalDateValue();
                  setDate(today);
                  void generateGuide(today);
                }}
                disabled={loading}
              >
                Today
              </button>
              <button type="button" className="secondary" onClick={copyGuide} disabled={!guide}>
                Copy text
              </button>
            </div>
          </div>

          <div className="status-bar">
            <span className="status-dot" aria-hidden="true" />
            <p>{error || status}</p>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="guide-stack">
            <SectionCard title="Daily Snapshot" kicker="SECTION 1">
              <p className="snapshot-line">{guide?.snapshot ?? "No guide generated yet."}</p>
            </SectionCard>

            <SectionCard title="Dominant Mode" kicker="SECTION 2">
              <div className="mode-block">
                <strong>{guide?.dominantMode.label ?? "..."}</strong>
                <p>{guide?.dominantMode.reason ?? "Generate a guide to see the daily mode."}</p>
              </div>
            </SectionCard>

            <SectionCard title="3 Actions" kicker="SECTION 3">
              <div className="action-list">
                <article>
                  <span>BODY</span>
                  <p>{guide?.actions.body ?? "Generate a guide to see the body action."}</p>
                </article>
                <article>
                  <span>MIND</span>
                  <p>{guide?.actions.mind ?? "Generate a guide to see the mind action."}</p>
                </article>
                <article>
                  <span>LIFE</span>
                  <p>{guide?.actions.life ?? "Generate a guide to see the life action."}</p>
                </article>
              </div>
            </SectionCard>

            <SectionCard title="Shadow Prompts" kicker="SECTION 4">
              <ol className="shadow-list">
                {guide?.shadowPrompts?.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}:</strong> <span>{item.prompt}</span>
                  </li>
                )) ?? <li>Generate a guide to unlock the prompts.</li>}
              </ol>
            </SectionCard>

            <SectionCard title="Warning Pattern" kicker="SECTION 5">
              <div className="warning-grid">
                <div>
                  <span>LIKELY TODAY</span>
                  <p>{guide?.warning.likelyToday ?? "..."}</p>
                </div>
                <div>
                  <span>CORRECTION</span>
                  <p>{guide?.warning.correction ?? "Generate a guide to see the correction."}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Today's Rule" kicker="SECTION 6">
              <p className="rule-block">{guide?.todayRule ?? "Generate a guide to see today's rule."}</p>
            </SectionCard>
          </div>

          <aside className="history-panel panel">
            <div className="history-head">
              <div>
                <p className="section-kicker">HISTORY</p>
                <h2>Saved readings</h2>
              </div>
              <button type="button" className="secondary" onClick={clearHistory} disabled={!history.length}>
                Clear
              </button>
            </div>

            <div className="history-list">
              {history.length ? (
                history.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className={`history-item ${entry.id === selectedId ? "active" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <div className="history-item-top">
                      <strong>{entry.date}</strong>
                      <span className={`badge badge-${entry.source}`}>{entry.source}</span>
                    </div>
                    <p>{getPreview(entry.guide)}</p>
                    <small>{formatGeneratedAt(entry.generatedAt)}</small>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <p>No saved history yet.</p>
                  <span>Your first generated reading will appear here and stay on this device.</span>
                </div>
              )}
            </div>

            {selectedHistory ? (
              <div className="history-footer">
                <p>Current selection</p>
                <strong>{selectedHistory.date}</strong>
                <span>{selectedHistory.summary}</span>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
