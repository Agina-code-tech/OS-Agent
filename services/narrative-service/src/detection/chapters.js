import { CHAPTER_SEQUENCE } from "../domain/constants.js";

function determineStage(narrative, occurrences = [], identitySignals = {}) {
  const frequency = occurrences.length || narrative.frequency || 0;
  const hasBeliefShift = (identitySignals.beliefChanges || []).length > 0 || (narrative.beliefShifts || []).length > 0;
  const hasValueShift = (identitySignals.valueShifts || []).length > 0 || (narrative.valueShifts || []).length > 0;
  const hasIdentityShift = (identitySignals.identityStatements || []).length > 0 || (narrative.identityShifts || []).length > 0;
  const integrationSignals = hasBeliefShift || hasValueShift || hasIdentityShift;

  if (narrative.trendDirection === "completed") return 4;
  if (frequency <= 1) return 1;
  if (frequency <= 3 && !integrationSignals) return 2;
  if (frequency <= 6 || integrationSignals) return 3;
  return 4;
}

export function buildNarrativeChapters(narrative, occurrences = [], identitySignals = {}) {
  const stage = determineStage(narrative, occurrences, identitySignals);

  return CHAPTER_SEQUENCE.map((chapter) => {
    let status = "pending";
    if (chapter.number < stage) status = "completed";
    if (chapter.number === stage) status = narrative.trendDirection === "completed" && chapter.number === 4 ? "completed" : "active";

    const summaries = {
      1: "The narrative first appears as repeated evidence in memories and reflections.",
      2: "The person experiments with new responses and tests a different way of living.",
      3: "Beliefs, values, and identity language begin to change.",
      4: "The new pattern is integrated into a more stable self-model.",
    };

    return {
      ...chapter,
      status,
      summary: summaries[chapter.number],
    };
  });
}

export function currentChapterFromChapters(chapters = []) {
  return chapters.find((chapter) => chapter.status === "active") || chapters.find((chapter) => chapter.status === "completed" && chapter.number === 4) || chapters[0] || null;
}
