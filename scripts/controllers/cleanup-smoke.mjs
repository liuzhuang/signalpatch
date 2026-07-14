#!/usr/bin/env node
// 【做什么】按 tracking ID 列表删除 Supabase 中 Smoke Test 写入的 synthetic Feedback
// 【何时跑】pr-outcome finalize；docs/runbook 人工运维
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

////////////////////////////////////////////////////
// 只按 Smoke Test 记录的 Tracking ID 清理数据，避免对业务 Feedback 做范围删除
////////////////////////////////////////////////////
for (const trackingId of trackingIds) {
  const url = new URL("/rest/v1/feedback", SUPABASE_URL);
  url.searchParams.set("tracking_id", `eq.${trackingId}`);
  await requestJson(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ synthetic: true }),
  });

  ////////////////////////////////////////////////////
  // 先再次标记为合成数据，再对同一个精确过滤条件执行删除
  ////////////////////////////////////////////////////
  await requestJson(url, { method: "DELETE", headers });
}
process.stdout.write(`${JSON.stringify({ deleted: trackingIds.length })}\n`);
