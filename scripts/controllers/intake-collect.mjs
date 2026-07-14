#!/usr/bin/env node
// 【做什么】从 Supabase 原子认领一条 PENDING Feedback，写出脱敏 evidence 与控制器 state
// 【何时跑】feedback-intake.yml collect Job
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

////////////////////////////////////////////////////
// 超过 30 分钟仍为 PROCESSING 的 Feedback 视为中断任务，重置后允许再次领取
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// 每次 Automation Run 只取最早的一条真实 Feedback，限制单轮处理范围
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// PATCH 同时要求当前状态仍为 PENDING；返回数量为零说明已被并发任务领取
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// 只把脱敏 Feedback 与 Feedback Context 写给 Intake Agent，数据库主键单独留给控制器
////////////////////////////////////////////////////
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
