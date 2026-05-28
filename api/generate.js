import { createGuideForDate } from "../src/server/guide-service.js";
import { readJsonBody, sendJson } from "../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await createGuideForDate(body?.date);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to generate guide.",
    });
  }
}
