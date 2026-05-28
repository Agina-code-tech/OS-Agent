import OpenAI from "openai";
import { buildAstrologyContext, buildFallbackGuide, GUIDE_SCHEMA } from "../lib/astrology.js";
import { createEntry } from "./history.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const SYSTEM_PROMPT = `You are an expert synthesist combining tropical astrology, somatic psychology and nervous system regulation, behavioral design and habit science, and Jungian shadow work.

Your job is to produce a practical daily operating system, not spiritual interpretation. Output must be usable in 5-10 minutes of reading. No fluff.

Use the provided date context to identify:
1. Zodiac season - current Sun sign from tropical astrology
2. Planetary day - day of week ruler
3. Element - Fire / Earth / Air / Water
4. Body zone - zodiac body correspondence

Return only JSON that matches the schema.

Style rules:
- No mystical language without behavioral meaning
- No long zodiac descriptions
- No repetition across sections
- No poetic shadow prompts
- No predictions, only present-tense behavioral guidance
- Prioritize behavioral psychology over symbolism
- Every output must answer: What do I actually do with this today?

Make the guidance specific, concrete, and usable today.`;

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function normalizeDateValue(dateValue) {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }

  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
  if (!match) {
    throw new Error("Invalid date. Expected YYYY-MM-DD.");
  }

  return dateValue;
}

function buildUserPrompt(context) {
  return [
    `Date: ${context.dateValue}`,
    `Season: ${context.season}`,
    `Planetary day: ${context.dayRuler} day`,
    `Element: ${context.element}`,
    `Body zone: ${context.bodyZone}`,
    "",
    "Generate the daily operating system using the exact context above.",
    "Keep the snapshot as a single line in the form: Season / Day Ruler day / Element / Body Zone.",
    "Keep the dominant mode to one of THINK, ACT, FEEL, EXPRESS, TRANSFORM.",
    "Write exactly five shadow prompts using the required labels.",
  ].join("\n");
}

async function runOpenAIGeneration(context) {
  if (!client) {
    return {
      source: "fallback",
      guide: buildFallbackGuide(context),
      model: null,
      requestId: null,
    };
  }

  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(context) },
    ],
    text: {
      format: {
        type: "json_schema",
        ...GUIDE_SCHEMA,
      },
      verbosity: "high",
    },
  });

  const guide = JSON.parse(response.output_text);
  return {
    source: "llm",
    guide,
    model: response.model || DEFAULT_MODEL,
    requestId: response.id || null,
  };
}

export async function createGuideForDate(dateValue) {
  const normalizedDateValue = normalizeDateValue(dateValue);
  const context = buildAstrologyContext(normalizedDateValue);

  try {
    const result = await runOpenAIGeneration(context);
    return {
      ok: true,
      entry: createEntry({
        context,
        source: result.source,
        model: result.model,
        requestId: result.requestId,
        guide: result.guide,
      }),
    };
  } catch (error) {
    const fallbackGuide = buildFallbackGuide(context);
    return {
      ok: true,
      fallback: true,
      error: error instanceof Error ? error.message : "OpenAI request failed.",
      entry: createEntry({
        context,
        source: "fallback",
        model: null,
        requestId: null,
        guide: fallbackGuide,
      }),
    };
  }
}
