#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvironment([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const outputDirectory = process.argv[2] ?? ".ai/runs/intake";
await mkdir(outputDirectory, { recursive: true });

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  "accept-profile": "signalpatch",
  "content-profile": "signalpatch",
};
const staleClaims = new URL("/rest/v1/feedback", SUPABASE_URL);
staleClaims.searchParams.set("intake_status", "eq.PROCESSING");
staleClaims.searchParams.set(
  "processing_started_at",
  `lt.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}`,
);
await requestJson(staleClaims, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    intake_status: "PENDING",
    processing_started_at: null,
  }),
});

const query = new URL("/rest/v1/feedback", SUPABASE_URL);
query.searchParams.set(
  "select",
  "id,tracking_id,message,context,created_at,intake_status",
);
query.searchParams.set("intake_status", "eq.PENDING");
query.searchParams.set("synthetic", "eq.false");
query.searchParams.set("order", "created_at.asc");
query.searchParams.set("limit", "1");
const [feedback] = await requestJson(query, { headers });

if (!feedback) {
  await writeFile(`${outputDirectory}/empty`, "true\n");
  process.stdout.write("No pending Feedback.\n");
  process.exit(0);
}

const claim = new URL("/rest/v1/feedback", SUPABASE_URL);
claim.searchParams.set("id", `eq.${feedback.id}`);
claim.searchParams.set("intake_status", "eq.PENDING");
const claimed = await requestJson(claim, {
  method: "PATCH",
  headers: { ...headers, prefer: "return=representation" },
  body: JSON.stringify({
    intake_status: "PROCESSING",
    processing_started_at: new Date().toISOString(),
  }),
});
if (claimed.length !== 1) {
  throw new Error("Feedback was claimed by another Automation Run");
}

const reference = `feedback:${feedback.tracking_id}`;
await writeFile(
  `${outputDirectory}/evidence.json`,
  `${JSON.stringify(
    {
      source: { kind: "feedback", reference },
      message: feedback.message,
      context: feedback.context,
      receivedAt: feedback.created_at,
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  `${outputDirectory}/state.json`,
  `${JSON.stringify({ feedbackId: feedback.id, reference }, null, 2)}\n`,
);
