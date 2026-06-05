import {
  CUE_PATTERNS,
  EMOTION_LEXICON,
  LIFE_DOMAIN_LEXICON,
  VALUE_LEXICON,
} from "../domain/constants.js";
import {
  countMatches,
  jaccardSimilarity,
  normalizeText,
  slugify,
  splitSentences,
  stableId,
  truncate,
  uniqueBy,
} from "../domain/text.js";

function makeNode(type, title, evidence, extra = {}) {
  return {
    type,
    title: truncate(title, 80),
    summary: truncate(extra.summary || evidence || title, 180),
    body: truncate(extra.body || evidence || title, 1200),
    evidence: evidence ? [truncate(evidence, 280)] : [],
    confidence: extra.confidence ?? 0.7,
    importance: extra.importance ?? 0.5,
    salience: extra.salience ?? 0.5,
    kind: extra.kind || type.toLowerCase(),
    conceptType: extra.conceptType || type.toLowerCase(),
    lifeDomains: extra.lifeDomains || [],
    tags: extra.tags || [],
    attributes: extra.attributes || {},
  };
}

function dedupeNodes(nodes) {
  return uniqueBy(nodes, (node) => `${node.type}:${slugify(node.title)}`);
}

function extractEmotionSignals(text) {
  const normalized = text.toLowerCase();
  const found = [];

  for (const emotion of EMOTION_LEXICON) {
    const hitCount = emotion.keywords.reduce((count, keyword) => {
      return normalized.includes(keyword.toLowerCase()) ? count + 1 : count;
    }, 0);

    if (!hitCount) continue;

    found.push({
      label: emotion.label,
      intensity: Math.min(1, emotion.intensity + hitCount * 0.08),
      polarity: emotion.polarity,
      keywords: emotion.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())),
    });
  }

  return found;
}

function inferLifeDomains(text) {
  const normalized = text.toLowerCase();
  return LIFE_DOMAIN_LEXICON.filter((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  ).map((entry) => entry.domain);
}

function extractCuedStatements(sentences, cueSet) {
  const statements = [];

  for (const sentence of sentences) {
    for (const pattern of cueSet) {
      if (!pattern.test(sentence)) continue;
      statements.push(sentence);
      break;
    }
  }

  return statements;
}

function extractValues(text) {
  const normalized = text.toLowerCase();
  return VALUE_LEXICON.filter((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  ).map((entry) => ({
    label: entry.label,
    evidence: entry.keywords.find((keyword) => normalized.includes(keyword.toLowerCase())) || entry.label,
  }));
}

function extractPeople(sentences) {
  const names = [];

  for (const sentence of sentences) {
    const matches = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
    for (const match of matches) {
      if (/^(The|This|That|When|After|Before|I)\b/.test(match)) continue;
      names.push({
        label: match.trim(),
        evidence: sentence,
      });
    }
  }

  return uniqueBy(names, (item) => slugify(item.label));
}

function extractProjects(sentences) {
  const projectSentences = extractCuedStatements(sentences, CUE_PATTERNS.projects);
  return projectSentences.map((sentence) => ({
    label: truncate(sentence.replace(/.*?(project|working on|building|launch)\s*/i, "").trim() || sentence, 70),
    evidence: sentence,
  }));
}

function extractPatterns(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.patterns).map((sentence) => ({
    label: truncate(sentence, 80),
    evidence: sentence,
  }));
}

function extractEvents(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.events).map((sentence) => ({
    label: truncate(sentence, 80),
    evidence: sentence,
  }));
}

function extractBeliefs(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.beliefs).map((sentence) => ({
    label: truncate(sentence, 100),
    evidence: sentence,
    polarity: /not\b|never\b|can't\b|cannot\b|won't\b/i.test(sentence) ? "negative" : "neutral",
  }));
}

function extractGoals(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.goals).map((sentence) => ({
    label: truncate(sentence, 100),
    evidence: sentence,
  }));
}

function extractDecisions(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.decisions).map((sentence) => ({
    label: truncate(sentence, 100),
    evidence: sentence,
  }));
}

function extractInsights(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.insights).map((sentence) => ({
    label: truncate(sentence, 100),
    evidence: sentence,
  }));
}

function extractRelationshipSignals(sentences) {
  return extractCuedStatements(sentences, CUE_PATTERNS.relationships).map((sentence) => ({
    label: truncate(sentence, 100),
    evidence: sentence,
  }));
}

export function analyzeReflection(input) {
  const text = normalizeText(input.text);
  const sentences = splitSentences(text);
  const domains = input.domains?.length ? input.domains : inferLifeDomains(text);
  const emotionSignals = extractEmotionSignals(text);
  const values = extractValues(text);
  const beliefs = extractBeliefs(sentences);
  const goals = extractGoals(sentences);
  const decisions = extractDecisions(sentences);
  const insights = extractInsights(sentences);
  const patterns = extractPatterns(sentences);
  const events = extractEvents(sentences);
  const people = extractPeople(sentences);
  const projects = extractProjects(sentences);
  const relationships = extractRelationshipSignals(sentences);

  const memoryTitle = truncate(sentences[0] || text.slice(0, 120) || "Reflection", 120);
  const rootConfidence = Math.min(0.95, 0.45 + emotionSignals.length * 0.1 + goals.length * 0.06 + patterns.length * 0.04);

  const nodes = [
    makeNode("Memory", memoryTitle, text, {
      summary: `Captured reflection across ${domains.join(", ") || "general life"}.`,
      confidence: rootConfidence,
      importance: Math.max(0.5, rootConfidence),
      salience: Math.min(1, 0.3 + sentences.length * 0.05 + emotionSignals.length * 0.1),
      kind: "reflection",
      conceptType: "memory",
      lifeDomains: domains,
      attributes: {
        sentenceCount: sentences.length,
        normalizedLength: text.length,
        sourceTextHash: stableId("mem", text).slice(4),
      },
    }),
    ...emotionSignals.map((emotion) =>
      makeNode("Emotion", emotion.label, emotion.keywords.join(", "), {
        summary: `Emotion signal for ${emotion.label}.`,
        confidence: emotion.intensity,
        importance: emotion.intensity,
        salience: emotion.intensity,
        kind: "emotion",
        attributes: emotion,
      }),
    ),
    ...beliefs.map((belief) =>
      makeNode("Belief", belief.label, belief.evidence, {
        summary: `Belief statement captured from the reflection.`,
        confidence: 0.72,
        importance: 0.68,
        salience: 0.62,
        kind: "belief",
        attributes: { polarity: belief.polarity },
      }),
    ),
    ...values.map((value) =>
      makeNode("Value", value.label, value.evidence, {
        summary: `Value inferred from language in the reflection.`,
        confidence: 0.68,
        importance: 0.76,
        salience: 0.58,
        kind: "value",
      }),
    ),
    ...goals.map((goal) =>
      makeNode("Goal", goal.label, goal.evidence, {
        summary: `Goal statement extracted from the reflection.`,
        confidence: 0.77,
        importance: 0.82,
        salience: 0.7,
        kind: "goal",
      }),
    ),
    ...patterns.map((pattern) =>
      makeNode("Pattern", pattern.label, pattern.evidence, {
        summary: `Recurring pattern language identified in the reflection.`,
        confidence: 0.73,
        importance: 0.79,
        salience: 0.66,
        kind: "pattern",
      }),
    ),
    ...events.map((event) =>
      makeNode("LifeEvent", event.label, event.evidence, {
        summary: `Life event extracted from temporal language.`,
        confidence: 0.71,
        importance: 0.72,
        salience: 0.68,
        kind: "life_event",
      }),
    ),
    ...people.map((person) =>
      makeNode("Person", person.label, person.evidence, {
        summary: `Person mention extracted from the reflection.`,
        confidence: 0.7,
        importance: 0.67,
        salience: 0.55,
        kind: "person",
      }),
    ),
    ...projects.map((project) =>
      makeNode("Project", project.label, project.evidence, {
        summary: `Project reference extracted from the reflection.`,
        confidence: 0.74,
        importance: 0.77,
        salience: 0.64,
        kind: "project",
      }),
    ),
    ...relationships.map((relationship) =>
      makeNode("Relationship", relationship.label, relationship.evidence, {
        summary: `Relationship signal extracted from the reflection.`,
        confidence: 0.7,
        importance: 0.7,
        salience: 0.6,
        kind: "relationship",
      }),
    ),
    ...decisions.map((decision) =>
      makeNode("Narrative", decision.label, decision.evidence, {
        summary: `Decision statement extracted from the reflection.`,
        confidence: 0.77,
        importance: 0.81,
        salience: 0.69,
        kind: "decision",
        conceptType: "decision",
      }),
    ),
    ...insights.map((insight) =>
      makeNode("Narrative", insight.label, insight.evidence, {
        summary: `Insight statement extracted from the reflection.`,
        confidence: 0.79,
        importance: 0.8,
        salience: 0.7,
        kind: "insight",
        conceptType: "insight",
      }),
    ),
  ];

  return {
    reflection: {
      userId: input.userId,
      reflectionId: input.reflectionId,
      source: input.source,
      text,
      normalizedText: text,
      summary: truncate(
        `Reflection about ${domains.join(", ") || "general life"} with ${emotionSignals.length} emotional signal(s) and ${goals.length} goal(s).`,
        240,
      ),
      domains,
      sentenceCount: sentences.length,
      emotionSignals,
      values,
      beliefs,
      goals,
      patterns,
      events,
      people,
      projects,
      relationships,
      decisions,
      insights,
      createdAt: input.occurredAt,
    },
    nodes: dedupeNodes(nodes),
    edges: [],
  };
}

