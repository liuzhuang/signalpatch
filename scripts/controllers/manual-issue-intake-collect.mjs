#!/usr/bin/env node
// 【做什么】从已有 content:raw Issue 读取脱敏的正文与用户补充评论
// 【何时跑】manual-issue-intake.yml collect Job；只读 GitHub，不创建 Issue
import { mkdir, writeFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";

const [requestedIssueNumber, outputDirectory = ".ai/runs/manual-issue-intake"] =
  process.argv.slice(2);
const { GH_TOKEN, GITHUB_REPOSITORY } = requireEnvironment([
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
]);
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
  const commentsUrl = new URL(
    `${repositoryUrl}/issues/${issue.number}/comments`,
  );
  commentsUrl.searchParams.set("per_page", "100");
  return requestJson(commentsUrl, { headers });
}

function hasNewUserContext(issue, comments) {
  if (!labelNames(issue).includes("ai:needs-input")) return true;
  const lastBotRequest = comments
    .filter(
      (comment) =>
        comment.user?.type === "Bot" &&
        comment.body?.includes("<!-- signalpatch-manual-needs-evidence:"),
    )
    .at(-1);
  if (!lastBotRequest) return true;
  return comments.some(
    (comment) =>
      comment.user?.type !== "Bot" &&
      Date.parse(comment.created_at) > Date.parse(lastBotRequest.created_at),
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
    if (issue.pull_request || !labelNames(issue).includes("content:raw"))
      continue;
    const comments = await loadComments(issue);
    if (hasNewUserContext(issue, comments)) return { issue, comments };
  }
  return null;
}

const selected = await loadIssue();
const issue = selected?.issue;
if (!issue || !labelNames(issue).includes("content:raw")) {
  await writeFile(`${outputDirectory}/empty`, "true\n");
  process.stdout.write("No open content:raw Issue.\n");
  process.exit(0);
}

const comments = selected.comments;
const reference = `manual-issue:${issue.number}`;
const evidence = {
  source: { kind: "manual-issue", reference },
  title: issue.title,
  message: issue.body ?? "",
  comments: comments
    .filter((comment) => comment.user?.type !== "Bot")
    .map((comment) => ({
      body: comment.body ?? "",
      createdAt: comment.created_at,
    })),
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
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`Selected Issue #${issue.number}.\n`);
