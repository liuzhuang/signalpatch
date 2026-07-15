#!/usr/bin/env node
// 【做什么】从新建、raw 或待更新的 Manual Issue 读取脱敏正文与用户评论
// 【何时跑】manual-issue-intake.yml collect Job；只读 GitHub，不创建 Issue
import { mkdir, writeFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import {
  isManualIssueCandidate,
  listAll,
  manualIssueContextFingerprint,
  manualIssueContextFrom,
} from "./lib/issue-lifecycle.mjs";

const [requestedIssueNumber, outputDirectory = ".ai/runs/manual-issue-intake"] =
  process.argv.slice(2);
const { GH_TOKEN, GITHUB_REPOSITORY, SIGNALPATCH_APP_BOT } = requireEnvironment(
  ["GH_TOKEN", "GITHUB_REPOSITORY", "SIGNALPATCH_APP_BOT"],
);
await mkdir(outputDirectory, { recursive: true });

const headers = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${GH_TOKEN}`,
  "x-github-api-version": "2022-11-28",
};
const repositoryUrl = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;

function labelNames(issue) {
  return issue.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  );
}

async function loadComments(issue) {
  return listAll(
    GITHUB_REPOSITORY,
    GH_TOKEN,
    `issues/${issue.number}/comments`,
  );
}

function hasNewUserContext(issue, comments) {
  if (!labelNames(issue).includes("ai:needs-input")) return true;
  const lastBotRequest = comments
    .filter(
      (comment) =>
        comment.user?.type === "Bot" &&
        comment.user?.login === SIGNALPATCH_APP_BOT &&
        comment.body?.includes("<!-- signalpatch-manual-needs-evidence:"),
    )
    .at(-1);
  if (!lastBotRequest) return true;
  const evaluatedContext = lastBotRequest.body?.match(
    /signalpatch-manual-needs-context:([0-9a-f]{64})/i,
  )?.[1];
  if (evaluatedContext) {
    return manualIssueContextFingerprint(issue, comments) !== evaluatedContext;
  }
  return comments.some(
    (comment) =>
      comment.user?.type !== "Bot" &&
      Date.parse(comment.updated_at ?? comment.created_at) >=
        Date.parse(lastBotRequest.created_at),
  );
}

async function loadIssue() {
  if (requestedIssueNumber) {
    if (!/^\d+$/.test(requestedIssueNumber)) {
      throw new Error("issue_number must be numeric");
    }
    const issue = await requestJson(
      `${repositoryUrl}/issues/${requestedIssueNumber}`,
      { headers },
    );
    return { issue, comments: await loadComments(issue) };
  }

  const url = new URL(`${repositoryUrl}/issues`);
  url.searchParams.set("state", "open");
  url.searchParams.set("labels", "content:raw");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "asc");
  url.searchParams.set("per_page", "100");
  const issues = await requestJson(url, { headers });
  for (const issue of issues) {
    const comments = await loadComments(issue);
    if (!isManualIssueCandidate(issue, comments, SIGNALPATCH_APP_BOT)) continue;
    if (hasNewUserContext(issue, comments)) return { issue, comments };
  }
  return null;
}

const selected = await loadIssue();
const issue = selected?.issue;
const eventName = process.env.GITHUB_EVENT_NAME ?? "";
const eventAction = process.env.SIGNALPATCH_EVENT_ACTION ?? "";
const forceEvaluation =
  eventName === "workflow_dispatch" ||
  (eventName === "issues" && ["edited", "reopened"].includes(eventAction)) ||
  (eventName === "issue_comment" && eventAction === "deleted");
if (
  !isManualIssueCandidate(
    issue,
    selected?.comments ?? [],
    SIGNALPATCH_APP_BOT,
  ) ||
  (!forceEvaluation && !hasNewUserContext(issue, selected.comments))
) {
  await writeFile(`${outputDirectory}/empty`, "true\n");
  process.stdout.write("No eligible manual content:raw Issue.\n");
  process.exit(0);
}

const comments = selected.comments;
const reference = `manual-issue:${issue.number}`;
const context = manualIssueContextFrom(issue, comments);
const evidence = {
  source: { kind: "manual-issue", reference },
  ...context,
  receivedAt: issue.created_at,
};

await writeFile(
  `${outputDirectory}/evidence.json`,
  `${JSON.stringify(evidence, null, 2)}\n`,
);
await writeFile(
  `${outputDirectory}/state.json`,
  `${JSON.stringify(
    {
      issueNumber: issue.number,
      reference,
      updatedAt: issue.updated_at,
      contextFingerprint: manualIssueContextFingerprint(issue, comments),
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`Selected Issue #${issue.number}.\n`);
