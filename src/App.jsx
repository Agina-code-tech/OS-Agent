import React, { useEffect, useMemo, useState } from "react";
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
  const [profileName, setProfileName] = useState(() => {
    if (typeof window === "undefined") return "Cosmic User";
    return window.localStorage.getItem("daily-cosmic-profile") || "Cosmic User";
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("daily-cosmic-profile", profileName);
  }, [profileName]);

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
  const avatarLetter = (profileName?.trim()?.[0] || "C").toUpperCase();

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="profile-strip" aria-label="profile">
        <div className="profile-chip">
          <div className="profile-avatar" aria-hidden="true">
            <span>{avatarLetter}</span>
          </div>
          <div className="profile-copy">
            <span className="profile-label">Private console</span>
            <span className="profile-name">{profileName}</span>
          </div>
        </div>
      </header>

      <main className="canvas-shell">
        <section className="master-panel">
          <header className="master-panel-header">
            <div className="master-title-block">
              <p className="panel-title">Daily Cosmic Guidance</p>
            </div>

            <div className="master-actions">
              <label className="field compact-field">
                <span>Date selector</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <div className="button-stack master-button-stack">
                <button type="button" onClick={() => generateGuide(date)} disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
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
                  Copy
                </button>
              </div>
            </div>
          </header>

          <div className="master-panel-body">
            <section className="feed-zone" aria-label="daily guidance">
              <div className="feed-stream">
                <article className="feed-row">
                  <span className="feed-label">Snapshot</span>
                  <p className="feed-value">{guide?.snapshot ?? "No guide generated yet."}</p>
                </article>

                <article className="feed-row">
                  <span className="feed-label">Dominant Mode</span>
                  <p className="feed-value">
                    {guide?.dominantMode
                      ? `${guide.dominantMode.label}. ${guide.dominantMode.reason}`
                      : "Generate a guide to see the daily mode."}
                  </p>
                </article>

                <article className="feed-row">
                  <span className="feed-label">Actions</span>
                  <div className="action-line">
                    <p>{guide?.actions?.mind ?? "MIND: Review the next three tasks in order."}</p>
                    <p>{guide?.actions?.body ?? "BODY: Practice slow breathing for 3 minutes."}</p>
                    <p>{guide?.actions?.life ?? "LIFE: Make one concrete decision today."}</p>
                  </div>
                </article>

                <article className="feed-row">
                  <span className="feed-label">Shadow Prompts</span>
                  <ul className="prompt-stream">
                    {guide?.shadowPrompts?.map((item) => (
                      <li key={item.label}>
                        <strong>{item.label}:</strong> <span>{item.prompt}</span>
                      </li>
                    )) ?? <li>Generate a guide to unlock the prompts.</li>}
                  </ul>
                </article>

                <article className="feed-row">
                  <span className="feed-label">Warning Pattern</span>
                  <div className="warning-inline">
                    <p>
                      <strong>Likely today:</strong> {guide?.warning?.likelyToday ?? "..."}
                    </p>
                    <p>
                      <strong>Correction:</strong>{" "}
                      {guide?.warning?.correction ?? "Generate a guide to see the correction."}
                    </p>
                  </div>
                </article>

                <article className="feed-row">
                  <span className="feed-label">Today&apos;s Rule</span>
                  <p className="feed-value">{guide?.todayRule ?? "Generate a guide to see today's rule."}</p>
                </article>

                <div className="status-bar status-bar-inline">
                  <span className="status-dot" aria-hidden="true" />
                  <p>{error || status}</p>
                </div>
              </div>
            </section>

            <aside className="history-panel">
              <div className="history-head compact">
                <div>
                  <p className="section-kicker">Historical Logs</p>
                  <h2>Historical Logs</h2>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={clearHistory}
                  disabled={!history.length}
                >
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
          </div>
        </section>
      </main>
    </div>
  );
}
