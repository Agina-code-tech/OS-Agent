import { average, stableHash } from "../domain/text.js";

export function computeTriggerCounts(triggerSignals = []) {
  return triggerSignals.reduce((acc, trigger) => {
    acc[trigger.label] = (acc[trigger.label] || 0) + trigger.count;
    return acc;
  }, {});
}

export function summarizeTopTriggers(triggerCounts = {}) {
  return Object.entries(triggerCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function buildOccurrenceId(record) {
  return stableHash(`${record.userId}:${record.patternId}:${record.occurrence.sourceHash}:${record.occurrence.occurredAt}`);
}

export function computeReinforcementCount(occurrences = []) {
  if (occurrences.length < 2) return 0;
  let reinforcementCount = 0;
  for (let index = 1; index < occurrences.length; index += 1) {
    const previous = occurrences[index - 1];
    const current = occurrences[index];
    const previousTriggers = new Set((previous.triggerSignals || []).map((trigger) => trigger.label));
    const currentTriggers = new Set((current.triggerSignals || []).map((trigger) => trigger.label));
    let overlap = 0;
    for (const trigger of currentTriggers) {
      if (previousTriggers.has(trigger)) overlap += 1;
    }
    if (overlap > 0) reinforcementCount += 1;
  }
  return reinforcementCount;
}

export function buildPatternWindowSummary(occurrences = []) {
  return {
    count: occurrences.length,
    averageIntensity: Number(average(occurrences.map((occurrence) => occurrence.intensity)).toFixed(4)),
    averageConfidence: Number(average(occurrences.map((occurrence) => occurrence.confidence)).toFixed(4)),
  };
}

