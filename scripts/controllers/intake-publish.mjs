#!/usr/bin/env node
// 【做什么】发布 raw Issue；证据充分时原地晋升 processed，重复则评论关闭
// 【何时跑】feedback-intake.yml publish Job
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import {
  ensureIssueComment,
  issueLabels,
  publishContractIssue,
  publishRawIssue,
} from "./lib/issue-lifecycle.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const [resultPath, statePath] = process.argv.slice(2);
if (!resultPath || !statePath) {
  throw new Error(
    "Usage: intake-publish.mjs <intake-result.json> <state.json>",
  );
}
const {
  GH_TOKEN,
  GITHUB_REPOSITORY,
  SIGNALPATCH_APP_BOT,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = requireEnvironment([
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
  "SIGNALPATCH_APP_BOT",
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

async function ensureProblem(issueNumber, summary, specReady, repairStatus) {
  const problemsUrl = new URL("/rest/v1/problems", SUPABASE_URL);
  problemsUrl.searchParams.set("issue_number", `eq.${issueNumber}`);
  problemsUrl.searchParams.set("select", "*");
  const [existing] = await requestJson(problemsUrl, {
    headers: databaseHeaders,
  });
  if (existing) return existing;

  const [problem] = await requestJson(
    new URL("/rest/v1/problems", SUPABASE_URL),
    {
      method: "POST",
      headers: { ...databaseHeaders, prefer: "return=representation" },
      body: JSON.stringify({
        summary,
        issue_number: issueNumber,
        spec_ready: specReady,
        repair_status: repairStatus,
      }),
    },
  );
  return problem;
}

async function updateFeedback(values) {
  const feedbackUrl = new URL("/rest/v1/feedback", SUPABASE_URL);
  feedbackUrl.searchParams.set("id", `eq.${state.feedbackId}`);
  await requestJson(feedbackUrl, {
    method: "PATCH",
    headers: databaseHeaders,
    body: JSON.stringify(values),
  });
}

////////////////////////////////////////////////////
// 证据不足也保留为 raw Issue；只写 Intake 的脱敏结论，不公开原始 Feedback
////////////////////////////////////////////////////
if (result.status === "NEEDS_EVIDENCE") {
  const marker = `signalpatch-feedback:${state.reference}`;
  const missingEvidenceCommentMarker = "signalpatch-needs-evidence";
  const issue = await publishRawIssue({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    marker,
    title: `[SignalPatch] Feedback needs evidence: ${state.reference}`,
    body: [
      "## Intake status\n\nNEEDS_EVIDENCE",
      `## Reason\n\n${result.reason}`,
      `## Missing evidence\n\n${result.missingEvidence.map((item) => `- ${item}`).join("\n")}`,
      `## Source reference\n\n${state.reference}`,
      `<!-- ${marker} -->`,
      "_This Issue contains a redacted Intake result. The original Feedback remains in Supabase._",
    ].join("\n\n"),
    labels: issueLabels.raw("ai:needs-input"),
    trustedBotLogin: SIGNALPATCH_APP_BOT,
  });
  await ensureIssueComment({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    issueNumber: issue.number,
    marker: missingEvidenceCommentMarker,
    trustedBotLogin: SIGNALPATCH_APP_BOT,
    body: [
      "## 需要补充上下文",
      "目前提供的信息不足，暂时无法生成可执行的开发任务。",
      "请直接在此 Issue 下补充以下内容，补充后我们会重新评估：",
      "",
      ...result.missingEvidence.map((item) => `- ${item}`),
    ].join("\n"),
  });
  const problem = await ensureProblem(
    issue.number,
    result.reason,
    false,
    "NEEDS_INPUT",
  );
  await updateFeedback({
    problem_id: problem.id,
    intake_status: "NEEDS_EVIDENCE",
    processing_started_at: null,
  });
  process.stdout.write(
    `${JSON.stringify({ issueNumber: issue.number, problemId: problem.id, status: "NEEDS_EVIDENCE" })}\n`,
  );
  process.exit(0);
}

const contract = result.contract;
if (
  contract.source.kind !== "feedback" ||
  contract.source.references.length !== 1 ||
  contract.source.references[0] !== state.reference
) {
  throw new Error("Feedback Issue Contract source does not match the Feedback");
}
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
// 同一个 Issue 先以 raw 创建；精确重复则评论并关闭，否则原地晋升为 processed
////////////////////////////////////////////////////
const { issue, duplicate } = await publishContractIssue({
  repository: GITHUB_REPOSITORY,
  token: GH_TOKEN,
  contract,
  idempotencyMarker: `signalpatch-feedback:${state.reference}`,
  trustedBotLogin: SIGNALPATCH_APP_BOT,
});
const canonicalIssue = duplicate ?? issue;

////////////////////////////////////////////////////
// Issue 创建成功后才建立 Problem，并把原始 Feedback 关联到该 Problem
////////////////////////////////////////////////////
const problem = await ensureProblem(
  canonicalIssue.number,
  contract.problemSummary,
  true,
  "QUALIFYING",
);
await updateFeedback({
  problem_id: problem.id,
  intake_status: "PROCESSED",
  processing_started_at: null,
  processed_at: new Date().toISOString(),
});
process.stdout.write(
  `${JSON.stringify({ issueNumber: issue.number, problemId: problem.id, duplicateOf: duplicate?.number ?? null })}\n`,
);
