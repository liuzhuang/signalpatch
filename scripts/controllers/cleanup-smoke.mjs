#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";

const [trackingIdsPath] = process.argv.slice(2);
if (!trackingIdsPath) {
  throw new Error("Usage: cleanup-smoke.mjs <tracking-ids-file>");
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvironment([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const trackingIds = (await readFile(trackingIdsPath, "utf8"))
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  "content-profile": "signalpatch",
};

for (const trackingId of trackingIds) {
  const url = new URL("/rest/v1/feedback", SUPABASE_URL);
  url.searchParams.set("tracking_id", `eq.${trackingId}`);
  await requestJson(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ synthetic: true }),
  });
  await requestJson(url, { method: "DELETE", headers });
}
process.stdout.write(`${JSON.stringify({ deleted: trackingIds.length })}\n`);
