import {
  DEFAULT_THRESHOLD,
  EMOTION_LEXICON,
  PATTERN_DEFINITIONS,
  SOURCE_TYPES,
  TRIGGER_LEXICON,
} from "../domain/constants.js";
import { normalizeText, stableHash, truncate, tokenise, uniqueBy } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function countKeywordHits(text, keywords = []) {
  const normalized = text.toLowerCase();
  const hits = [];
  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      hits.push(keyword);
    }
  }
  return hits;
}

function createExcerpt(text, keywords) {
  const sentences = normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const matchingSentence = sentences.find((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword.toLowerCase())),
  );

  return truncate(matchingSentence || sentences[0] || text, 240);
}

function buildSignal(definition, text, sourceType, sourceId) {
  const keywordHits = countKeywordHits(text, definition.keywords);
  if (!keywordHits.length) return null;

  const triggerHits = definition.triggers ? countKeywordHits(text, definition.triggers) : [];
  const intensity = clamp(0.42 + keywordHits.length * 0.12 + triggerHits.length * 0.05);
  const confidence = clamp(0.54 + keywordHits.length * 0.08 + triggerHits.length * 0.04);

  return {
    key: definition.key,
    family: definition.family,
    label: definition.label,
    kind: definition.kind,
    sourceType,
    sourceId,
    intensity,
    confidence,
    keywordHits,
    triggerHits,
    evidence: createExcerpt(text, [...keywordHits, ...triggerHits]),
    semanticHash: stableHash(`${definition.key}:${tokenise(text).slice(0, 40).join(" ")}`),
  };
}

function detectEmotions(text, sourceType, sourceId) {
  return EMOTION_LEXICON.flatMap((emotion) => {
    const hits = countKeywordHits(text, emotion.keywords);
    if (!hits.length) return [];
    const intensity = clamp(0.5 + hits.length * 0.1);
    return [{
      key: `emotion.${emotion.label}`,
      family: "emotional",
      label: `recurring ${emotion.label}`,
      kind: "emotion",
      sourceType,
      sourceId,
      intensity,
      confidence: clamp(0.58 + hits.length * 0.07),
      keywordHits: hits,
      triggerHits: countKeywordHits(text, ["work", "home", "relationship", "money", "health", "conflict", "deadline"]),
      evidence: createExcerpt(text, hits),
      semanticHash: stableHash(`emotion.${emotion.label}:${tokenise(text).slice(0, 40).join(" ")}`),
    }];
  });
}

function buildPatternSignals(text, sourceType, sourceId) {
  const patternSignals = PATTERN_DEFINITIONS.flatMap((definition) => {
    const signal = buildSignal(definition, text, sourceType, sourceId);
    return signal ? [signal] : [];
  });

  return uniqueBy([
    ...patternSignals,
    ...detectEmotions(text, sourceType, sourceId),
  ], (signal) => `${signal.family}:${signal.label}:${signal.kind}`);
}

function deriveTriggerSignals(text) {
  return TRIGGER_LEXICON.flatMap((trigger) => {
    const hits = countKeywordHits(text, trigger.keywords);
    return hits.length ? [{ label: trigger.label, hits, count: hits.length }] : [];
  });
}

function deriveSourceType(sourceType) {
  const normalized = String(sourceType || "reflection").trim().toLowerCase();
  return SOURCE_TYPES.includes(normalized) ? normalized : "reflection";
}

export function analyzePatternInput(input) {
  const text = normalizeText(input.text);
  const sourceType = deriveSourceType(input.sourceType || input.source || "reflection");
  const sourceId = input.sourceId ? String(input.sourceId) : null;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString();
  const signals = buildPatternSignals(text, sourceType, sourceId);
  const triggerSignals = deriveTriggerSignals(text);
  const wordCount = tokenise(text).length;
  const intensityBoost = clamp(0.4 + Math.min(0.4, signals.length * 0.06) + Math.min(0.2, triggerSignals.length * 0.03));

  return {
    userId: String(input.userId || "").trim(),
    text,
    sourceType,
    sourceId,
    occurredAt,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    signals,
    triggerSignals,
    wordCount,
    sourceHash: stableHash(`${sourceType}:${sourceId || ""}:${text}`),
    baselineIntensity: intensityBoost,
    baselineConfidence: clamp(0.56 + Math.min(0.26, signals.length * 0.04) + Math.min(0.14, triggerSignals.length * 0.03)),
    excerpt: truncate(text, 320),
  };
}

export function shouldDetectSignal(signal) {
  return signal && signal.confidence >= DEFAULT_THRESHOLD.triggerMatch;
}

export function patternFamilyFromLabel(label = "") {
  const normalized = String(label).toLowerCase();
  if (normalized.includes("anxiety") || normalized.includes("joy") || normalized.includes("shame") || normalized.includes("anger") || normalized.includes("confidence")) {
    return "emotional";
  }
  if (normalized.includes("abandonment") || normalized.includes("conflict") || normalized.includes("people pleasing") || normalized.includes("distancing")) {
    return "relationship";
  }
  if (normalized.includes("catastroph") || normalized.includes("criticism") || normalized.includes("black-and-white") || normalized.includes("validation") || normalized.includes("future fixation")) {
    return "cognitive";
  }
  return "behavioral";
}
