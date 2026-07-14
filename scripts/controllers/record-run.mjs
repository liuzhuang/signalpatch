#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import { repairStatusForRun } from "./lib/run-status.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const issueNumber = option("--issue");
const stage = option("--stage");
const state = option("--state");
const headSha = option("--head-sha", null);
const attempt = Number(option("--attempt", "0"));
const pullRequestNumber = option("--pr", null);
const previewUrl = option("--preview-url", null);
const productionUrl = option("--production-url", null);
const failureFingerprint = option("--failure-fingerprint", null);
const contractPath = option("--contract", null);
if (!issueNumber || !stage || !state) {
  throw new Error(
    "Usage: record-run.mjs --issue N --stage NAME --state STATE [options]",
  );
}
const { GITHUB_REPOSITORY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
  requireEnvironment([
    "GITHUB_REPOSITORY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  "accept-profile": "signalpatch",
  "content-profile": "signalpatch",
};
const problemsUrl = new URL("/rest/v1/problems", SUPABASE_URL);
problemsUrl.searchParams.set("select", "id");
problemsUrl.searchParams.set("issue_number", `eq.${issueNumber}`);
problemsUrl.searchParams.set("limit", "1");
let [problem] = await requestJson(problemsUrl, { headers });
if (!problem) {
  ////////////////////////////////////////////////////
  // 对话来源可能没有预建 Problem；首次记录时根据已验证 Contract 补建关联记录
  ////////////////////////////////////////////////////
  if (!contractPath) {
    throw new Error(`Problem not found for Issue #${issueNumber}`);
  }
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  [problem] = await requestJson(new URL("/rest/v1/problems", SUPABASE_URL), {
    method: "POST",
    headers: { ...headers, prefer: "return=representation" },
    body: JSON.stringify({
      summary: contract.problemSummary,
      issue_number: Number(issueNumber),
      spec_ready: true,
      repair_status: "BUILDING",
    }),
  });
}

////////////////////////////////////////////////////
// 仓库、Issue、阶段、Head SHA 和尝试次数共同标识一次 Automation Run
////////////////////////////////////////////////////
const idempotencyKey = [
  GITHUB_REPOSITORY,
  issueNumber,
  stage,
  headSha ?? "none",
  attempt,
].join(":");
const runsUrl = new URL("/rest/v1/automation_runs", SUPABASE_URL);
runsUrl.searchParams.set("on_conflict", "idempotency_key");

////////////////////////////////////////////////////
// 重复 Workflow 事件命中同一幂等键时更新原记录，不新增重复 Automation Run
////////////////////////////////////////////////////
await requestJson(runsUrl, {
  method: "POST",
  headers: {
    ...headers,
    prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify({
    problem_id: problem.id,
    issue_number: Number(issueNumber),
    pull_request_number: pullRequestNumber ? Number(pullRequestNumber) : null,
    stage,
    state,
    idempotency_key: idempotencyKey,
    head_sha: headSha,
    attempt,
    failure_fingerprint: failureFingerprint,
    preview_url: previewUrl,
    production_url: productionUrl,
  }),
});
const repairStatus = repairStatusForRun(stage, state);
if (repairStatus) {
  ////////////////////////////////////////////////////
  // 只有状态映射明确的阶段结果才更新 Problem，失败中间态不会覆盖现有 Repair Status
  ////////////////////////////////////////////////////
  const problemUrl = new URL("/rest/v1/problems", SUPABASE_URL);
  problemUrl.searchParams.set("id", `eq.${problem.id}`);
  await requestJson(problemUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ repair_status: repairStatus }),
  });
}
process.stdout.write(`${JSON.stringify({ idempotencyKey })}\n`);
