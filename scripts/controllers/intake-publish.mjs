#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const [resultPath, statePath] = process.argv.slice(2);
if (!resultPath || !statePath) {
  throw new Error(
    "Usage: intake-publish.mjs <intake-result.json> <state.json>",
  );
}
const { GH_TOKEN, GITHUB_REPOSITORY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
  requireEnvironment([
    "GH_TOKEN",
    "GITHUB_REPOSITORY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
const { result } = JSON.parse(await readFile(resultPath, "utf8"));
const state = JSON.parse(await readFile(statePath, "utf8"));
const databaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  "content-profile": "signalpatch",
};

////////////////////////////////////////////////////
// 证据不足时保留 Feedback，不创建 GitHub Issue，也不启动 Delivery
////////////////////////////////////////////////////
if (result.status === "NEEDS_EVIDENCE") {
  const feedbackUrl = new URL("/rest/v1/feedback", SUPABASE_URL);
  feedbackUrl.searchParams.set("id", `eq.${state.feedbackId}`);
  await requestJson(feedbackUrl, {
    method: "PATCH",
    headers: databaseHeaders,
    body: JSON.stringify({
      intake_status: "NEEDS_EVIDENCE",
      processing_started_at: null,
    }),
  });
  process.stdout.write(
    "Feedback retained as a Problem candidate pending evidence.\n",
  );
  process.exit(0);
}

const contract = result.contract;
const policy = await loadPolicy();

////////////////////////////////////////////////////
// 发布前按允许修改路径重新计算风险，模型给出的等级只能被确定性策略上调
////////////////////////////////////////////////////
contract.riskLevel = requiredRisk(
  policy,
  contract.allowedPaths,
  contract.riskLevel,
);

////////////////////////////////////////////////////
// Issue 同时包含可读问题摘要和完整 Issue Contract，Delivery 以后者为执行依据
////////////////////////////////////////////////////
const issueBody = [
  `## Problem\n\n${contract.problemSummary}`,
  `## Actual behavior\n\n${contract.actualBehavior}`,
  `## Expected behavior\n\n${contract.expectedBehavior}`,
  "<!-- signalpatch-contract:start -->",
  "```json",
  JSON.stringify(contract, null, 2),
  "```",
  "<!-- signalpatch-contract:end -->",
  "\n_This Issue contains redacted evidence only. Raw conversations are not included._",
].join("\n\n");
const issue = await requestJson(
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`,
  {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${GH_TOKEN}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      title: `[SignalPatch] ${contract.problemSummary}`,
      body: issueBody,
      labels: ["ai:ready", `risk:${contract.riskLevel.toLowerCase()}`],
    }),
  },
);

////////////////////////////////////////////////////
// Issue 创建成功后才建立 Problem，并把原始 Feedback 关联到该 Problem
////////////////////////////////////////////////////
const [problem] = await requestJson(
  new URL("/rest/v1/problems", SUPABASE_URL),
  {
    method: "POST",
    headers: { ...databaseHeaders, prefer: "return=representation" },
    body: JSON.stringify({
      summary: contract.problemSummary,
      issue_number: issue.number,
      spec_ready: true,
      repair_status: "QUALIFYING",
    }),
  },
);
const feedbackUrl = new URL("/rest/v1/feedback", SUPABASE_URL);
feedbackUrl.searchParams.set("id", `eq.${state.feedbackId}`);
await requestJson(feedbackUrl, {
  method: "PATCH",
  headers: databaseHeaders,
  body: JSON.stringify({
    problem_id: problem.id,
    intake_status: "PROCESSED",
    processing_started_at: null,
    processed_at: new Date().toISOString(),
  }),
});

////////////////////////////////////////////////////
// 使用显式 workflow_dispatch 启动 Delivery，不依赖 GitHub Token 写入产生隐式事件
////////////////////////////////////////////////////
await requestJson(
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/issue-delivery.yml/dispatches`,
  {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${GH_TOKEN}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { issue_number: String(issue.number) },
    }),
  },
);
process.stdout.write(
  `${JSON.stringify({ issueNumber: issue.number, problemId: problem.id })}\n`,
);
