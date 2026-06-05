import { average } from "../domain/text.js";

function precisionAtK(results = [], expectedIds = [], k = 5) {
  if (!k) return 0;
  const selected = results.slice(0, k).map((item) => item.documentId || item.document?.id || item.id || item.source?.id);
  const hits = selected.filter((id) => expectedIds.includes(id)).length;
  return hits / k;
}

function recallAtK(results = [], expectedIds = [], k = 5) {
  if (!expectedIds.length) return 0;
  const selected = results.slice(0, k).map((item) => item.documentId || item.document?.id || item.id || item.source?.id);
  const hits = selected.filter((id) => expectedIds.includes(id)).length;
  return hits / expectedIds.length;
}

function citationCoverage(results = []) {
  if (!results.length) return 0;
  const cited = results.filter((result) => result.source?.citation || result.citation).length;
  return cited / results.length;
}

function confidenceCalibration(results = []) {
  if (!results.length) return 0;
  return average(results.map((result) => result.confidence || 0));
}

export async function evaluateRetrievalBenchmark({ name = "benchmark", queries = [] } = {}, retrieveFn) {
  const details = [];
  for (const query of queries) {
    const response = await retrieveFn(query.query, query.options || {});
    details.push({
      query: query.query,
      precisionAt5: precisionAtK(response.results || [], query.expectedDocumentIds || [], 5),
      recallAt5: recallAtK(response.results || [], query.expectedDocumentIds || [], 5),
      citationCoverage: citationCoverage(response.results || []),
      confidence: confidenceCalibration(response.results || []),
    });
  }

  const metrics = {
    precisionAt5: average(details.map((item) => item.precisionAt5)),
    recallAt5: average(details.map((item) => item.recallAt5)),
    citationCoverage: average(details.map((item) => item.citationCoverage)),
    confidence: average(details.map((item) => item.confidence)),
  };

  return {
    ok: true,
    name,
    metrics,
    details,
  };
}
