import { DISALLOWED_QUERY_TERMS } from "../domain/constants.js";

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isDisallowedQuery(query = "") {
  const normalized = String(query).toLowerCase();
  return DISALLOWED_QUERY_TERMS.some((term) => {
    const pattern = new RegExp(`(?:^|\\W)${escapeRegExp(term)}(?:$|\\W)`, "i");
    return pattern.test(normalized);
  });
}

export function buildSafetyRefusal(query = "") {
  return {
    ok: false,
    error: "This service provides educational psychology and evidence retrieval, not diagnosis or therapy.",
    query: String(query || ""),
    safeAlternatives: [
      "Ask for a framework such as attachment theory, CBT, ACT, Jungian psychology, or emotional regulation research.",
      "Ask for evidence-based concepts that explain a pattern without diagnosing it.",
      "Ask for citations and educational context around a behavior or feeling.",
    ],
  };
}
