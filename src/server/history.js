import { buildHistorySummary } from "../lib/astrology.js";

export function createEntry({ context, source, model, requestId, guide }) {
  return {
    id: context.dateValue,
    date: context.dateValue,
    generatedAt: new Date().toISOString(),
    source,
    model,
    requestId,
    context: {
      season: context.season,
      dayRuler: context.dayRuler,
      element: context.element,
      bodyZone: context.bodyZone,
    },
    guide,
    summary: buildHistorySummary(guide),
  };
}
