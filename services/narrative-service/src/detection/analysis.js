import {
  BELIEF_SHIFT_PHRASES,
  DEFAULT_THRESHOLD,
  EMOTION_LEXICON,
  EMOTIONAL_MATURATION_PHRASES,
  EXPERIMENTATION_PHRASES,
  IDENTITY_SHIFT_PHRASES,
  NARRATIVE_DEFINITIONS,
  SOURCE_TYPES,
  VALUE_SHIFT_PHRASES,
} from "../domain/constants.js";
import { normalizeText, splitSentences, stableHash, truncate, tokenise, uniqueBy, countMatches } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function flattenRefs(values, kind) {
  const items = [];
  for (const value of values.flat().filter(Boolean)) {
    if (Array.isArray(value)) {
      items.push(...flattenRefs(value, kind));
      continue;
    }
    if (typeof value === "string") {
      const text = String(value).trim();
      if (!text) continue;
      items.push({
        id: text,
        label: text,
        summary: text,
        kind,
      });
      continue;
    }
    if (typeof value === "object") {
      const label = String(value.label || value.name || value.title || value.summary || value.id || value.key || kind).trim();
      const summary = String(value.summary || value.text || value.description || label).trim();
      items.push({
        id: String(value.id || value.key || stableHash(`${kind}:${label}`).slice(0, 20)),
        label,
        summary,
        occurredAt: value.occurredAt || value.occurred_at || value.date || value.timestamp || value.createdAt || null,
        kind,
      });
    }
  }
  return uniqueBy(items, (item) => item.id);
}

function deriveSourceType(sourceType) {
  const normalized = String(sourceType || "reflection").trim().toLowerCase();
  return SOURCE_TYPES.includes(normalized) ? normalized : "reflection";
}

function buildSupportText(refs) {
  return [
    ...refs.supportingMemories.map((item) => [item.label, item.summary].filter(Boolean).join(" ")),
    ...refs.supportingPatterns.map((item) => [item.label, item.summary].filter(Boolean).join(" ")),
    ...refs.supportingEmotions.map((item) => [item.label, item.summary].filter(Boolean).join(" ")),
    ...refs.supportingGoals.map((item) => [item.label, item.summary].filter(Boolean).join(" ")),
  ].join(" ");
}

function matchKeywordHits(text, keywords) {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function countReferenceHits(refs, keywords, kind = "label") {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return refs.filter((ref) => {
    const haystack = String(ref[kind] || ref.summary || ref.label || "").toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

function createExcerpt(text, keywords, supportText) {
  const sentences = splitSentences(text);
  const matchingSentence = sentences.find((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword.toLowerCase())),
  );
  if (matchingSentence) return truncate(matchingSentence, 260);
  if (supportText) return truncate(supportText, 260);
  return truncate(sentences[0] || text, 260);
}

function extractIdentitySignals(text) {
  const sentences = splitSentences(text);

  const beliefChanges = sentences
    .filter((sentence) => BELIEF_SHIFT_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .map((text) => ({ text, kind: "belief" }));

  const valueShifts = sentences
    .filter((sentence) => VALUE_SHIFT_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .map((text) => ({ text, kind: "value" }));

  const identityStatements = sentences
    .filter((sentence) => IDENTITY_SHIFT_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .map((text) => ({ text, kind: "identity" }));

  const emotionalMaturation = sentences
    .filter((sentence) => EMOTIONAL_MATURATION_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .map((text) => ({ text, kind: "maturation" }));

  const experimentation = sentences
    .filter((sentence) => EXPERIMENTATION_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase)))
    .map((text) => ({ text, kind: "experiment" }));

  return {
    beliefChanges: uniqueBy(beliefChanges, (item) => item.text),
    valueShifts: uniqueBy(valueShifts, (item) => item.text),
    identityStatements: uniqueBy(identityStatements, (item) => item.text),
    emotionalMaturation: uniqueBy(emotionalMaturation, (item) => item.text),
    experimentation: uniqueBy(experimentation, (item) => item.text),
  };
}

function buildNarrativeSignal(definition, text, supportText, refs) {
  const keywordHits = matchKeywordHits(text, definition.keywords);
  const supportPatternHits = countReferenceHits(refs.supportingPatterns, definition.supportingPatterns);
  const supportEmotionHits = countReferenceHits(refs.supportingEmotions, definition.supportingEmotions);
  const supportGoalHits = countReferenceHits(refs.supportingGoals, definition.supportingGoals);
  const supportMemoryHits = countReferenceHits(refs.supportingMemories, [...definition.keywords, ...definition.themes], "summary");

  const intensity = clamp(
    0.24 +
      keywordHits.length * 0.12 +
      supportPatternHits.length * 0.09 +
      supportEmotionHits.length * 0.06 +
      supportGoalHits.length * 0.06 +
      supportMemoryHits.length * 0.03,
  );
  const confidence = clamp(
    0.42 +
      keywordHits.length * 0.1 +
      supportPatternHits.length * 0.08 +
      supportEmotionHits.length * 0.05 +
      supportGoalHits.length * 0.05 +
      supportMemoryHits.length * 0.03,
  );

  const identitySignals = extractIdentitySignals(text);
  const identityBoost = identitySignals.identityStatements.length + identitySignals.beliefChanges.length + identitySignals.valueShifts.length;

  const combinedIntensity = clamp(intensity + Math.min(0.18, identityBoost * 0.04));
  const combinedConfidence = clamp(confidence + Math.min(0.16, identityBoost * 0.03));

  const matchingThemes = definition.themes.filter((theme) =>
    supportText.toLowerCase().includes(theme.toLowerCase()) ||
    text.toLowerCase().includes(theme.toLowerCase()),
  );

  return {
    key: definition.key,
    family: definition.family,
    label: definition.label,
    kind: definition.kind,
    sourceType: refs.sourceType,
    sourceId: refs.sourceId,
    intensity: combinedIntensity,
    confidence: combinedConfidence,
    keywordHits,
    supportPatternHits: supportPatternHits.map((item) => item.label),
    supportEmotionHits: supportEmotionHits.map((item) => item.label),
    supportGoalHits: supportGoalHits.map((item) => item.label),
    supportMemoryHits: supportMemoryHits.map((item) => item.id),
    themes: uniqueBy([...definition.themes, ...matchingThemes], (item) => item),
    evidence: createExcerpt(text, [...keywordHits, ...definition.supportingPatterns, ...definition.supportingGoals], supportText),
    semanticHash: stableHash(`${definition.key}:${tokenise(text).slice(0, 40).join(" ")}`),
  };
}

function shouldAcceptSignal(signal) {
  return signal && signal.confidence >= DEFAULT_THRESHOLD.supportMatch;
}

export function analyzeNarrativeInput(input) {
  const sourceType = deriveSourceType(input.sourceType || input.source || "reflection");
  const sourceId = input.sourceId ? String(input.sourceId) : null;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString();
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const supportingMemories = flattenRefs([
    input.supportingMemories,
    input.supportingMemoryIds,
    metadata.supportingMemories,
    metadata.supportingMemoryIds,
  ], "memory");
  const supportingPatterns = flattenRefs([
    input.supportingPatterns,
    input.supportingPatternIds,
    metadata.supportingPatterns,
    metadata.supportingPatternIds,
  ], "pattern");
  const supportingEmotions = flattenRefs([
    input.supportingEmotions,
    input.supportingEmotionLabels,
    metadata.supportingEmotions,
    metadata.supportingEmotionLabels,
  ], "emotion");
  const supportingGoals = flattenRefs([
    input.supportingGoals,
    input.supportingGoalIds,
    metadata.supportingGoals,
    metadata.supportingGoalIds,
  ], "goal");

  const text = normalizeText(input.text || input.content || input.narrative || input.summary || "");
  const supportText = buildSupportText({
    supportingMemories,
    supportingPatterns,
    supportingEmotions,
    supportingGoals,
  });
  const contextText = normalizeText([text, supportText].filter(Boolean).join("\n"));
  const signals = uniqueBy(
    NARRATIVE_DEFINITIONS.flatMap((definition) => {
      const signal = buildNarrativeSignal(definition, contextText || supportText, supportText, {
        sourceType,
        sourceId,
        supportingMemories,
        supportingPatterns,
        supportingEmotions,
        supportingGoals,
      });
      return shouldAcceptSignal(signal) ? [signal] : [];
    }),
    (signal) => signal.key,
  );

  const identitySignals = extractIdentitySignals(contextText || supportText);

  return {
    userId: String(input.userId || "").trim(),
    text,
    contextText,
    sourceType,
    sourceId,
    occurredAt,
    metadata,
    supportingMemories,
    supportingPatterns,
    supportingEmotions,
    supportingGoals,
    signals,
    identitySignals,
    wordCount: tokenise(contextText).length,
    sourceHash: stableHash(`${sourceType}:${sourceId || ""}:${contextText}`),
    baselineIntensity: clamp(0.38 + Math.min(0.34, signals.length * 0.07) + Math.min(0.16, identitySignals.identityStatements.length * 0.04)),
    baselineConfidence: clamp(0.46 + Math.min(0.3, signals.length * 0.05) + Math.min(0.12, identitySignals.identityStatements.length * 0.03)),
    excerpt: truncate(contextText || text, 320),
  };
}

export function shouldDetectNarrative(signal) {
  return signal && signal.confidence >= DEFAULT_THRESHOLD.supportMatch;
}
