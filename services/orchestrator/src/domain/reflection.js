import { normalizeText, splitSentences, stableHash, tokenise, truncate, uniqueBy } from "./text.js";

const THEME_KEYWORDS = [
  { label: "work pressure", terms: ["work", "job", "manager", "deadline", "project", "career"] },
  { label: "boundaries", terms: ["boundary", "boundaries", "say no", "overextend", "overextending", "people pleasing"] },
  { label: "anxiety", terms: ["anxious", "anxiety", "worried", "worry", "panic", "fear"] },
  { label: "burnout", terms: ["burnout", "burnt out", "exhausted", "drained", "overwhelmed"] },
  { label: "relationships", terms: ["relationship", "partner", "friend", "family", "mother", "father", "abandonment"] },
  { label: "self-criticism", terms: ["self-criticism", "criticize", "shame", "ashamed", "judgment"] },
  { label: "rest", terms: ["rest", "sleep", "recover", "space", "pause", "slow down"] },
  { label: "growth", terms: ["learn", "practice", "improve", "change", "build", "grow"] },
  { label: "identity", terms: ["identity", "becoming", "who i am", "self"] },
];

const POSITIVE_WORDS = ["calm", "clear", "rest", "learn", "improve", "trust", "safe", "steady", "support", "grow"];
const NEGATIVE_WORDS = ["anxious", "afraid", "worried", "ashamed", "exhausted", "angry", "overwhelmed", "stuck", "avoid", "burnout"];

export function normalizeOrchestratorInput(input = {}) {
  const userId = String(input.userId || "").trim();
  const text = normalizeText(input.text || input.content || input.body || "");
  if (!userId) throw new Error("userId is required");
  if (!text) throw new Error("text is required");

  return {
    userId,
    text,
    source: String(input.source || input.sourceType || "reflection"),
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString(),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    domains: Array.isArray(input.domains) ? input.domains : [],
    requestId: input.requestId ? String(input.requestId) : stableHash(`${userId}:${text}`).slice(0, 16),
  };
}

function detectThemes(text) {
  const normalized = text.toLowerCase();
  return THEME_KEYWORDS.flatMap((entry) => (
    entry.terms.some((term) => normalized.includes(term.toLowerCase())) ? [entry.label] : []
  ));
}

function detectSentiment(text) {
  const tokens = tokenise(text);
  let positive = 0;
  let negative = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.includes(token)) positive += 1;
    if (NEGATIVE_WORDS.includes(token)) negative += 1;
  }
  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  if (positive || negative) return "mixed";
  return "neutral";
}

function buildSummary(sentences = [], themes = []) {
  const prefix = themes.length ? `Themes: ${themes.slice(0, 3).join(", ")}.` : "";
  const body = truncate(sentences.slice(0, 2).join(" "), 220) || "Reflection captured.";
  return truncate([prefix, body].filter(Boolean).join(" "), 260);
}

export function buildReflectionUnderstanding(input = {}) {
  const text = normalizeText(input.text || "");
  const sentences = splitSentences(text);
  const themes = uniqueBy([
    ...detectThemes(text),
    ...(input.metadata?.themes || []),
    ...input.domains,
  ].filter(Boolean), (value) => String(value).toLowerCase());

  return {
    summary: buildSummary(sentences, themes),
    themes,
    sentiment: detectSentiment(text),
    sentences: sentences.slice(0, 5),
    focusQuery: buildFocusQuery(input, themes, sentences),
  };
}

export function buildFocusQuery(input = {}, themes = [], sentences = []) {
  const parts = [
    ...(themes || []).slice(0, 4),
    input.metadata?.researchQuery,
    sentences[0],
    sentences[1],
    input.text,
  ].filter(Boolean);
  return truncate(parts.join(" "), 280);
}

