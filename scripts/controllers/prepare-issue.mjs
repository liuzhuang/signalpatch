#!/usr/bin/env node
// 【做什么】从 GitHub Issue 提取 Issue Contract 标记块，写出 contract.json 与 issue 快照
// 【何时跑】issue-delivery prepare；pr-gate trust；pr-outcome trust
import { mkdir, writeFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import {
  isCurrentManualRevision,
  isReadyForDelivery,
  isTrustedIssueAuthor,
  listAll,
  manualContractComment,
} from "./lib/issue-lifecycle.mjs";

const [issueNumber, outputDirectory = ".ai/runs/delivery", mode] =
  process.argv.slice(2);
if (!issueNumber) {
  throw new Error(
    "Usage: prepare-issue.mjs <issue-number> [output-directory] [--require-ready]",
  );
}
if (mode && mode !== "--require-ready") {
  throw new Error(`Unsupported prepare mode: ${mode}`);
}
const { GH_TOKEN, GITHUB_REPOSITORY } = requireEnvironment([
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
]);
const appBot = process.env.SIGNALPATCH_APP_BOT ?? process.env.APP_BOT ?? "";
const issue = await requestJson(
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}`,
  {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${GH_TOKEN}`,
      "x-github-api-version": "2022-11-28",
    },
  },
);

await mkdir(outputDirectory, { recursive: true });
if (mode === "--require-ready" && !isReadyForDelivery(issue)) {
  await writeFile(`${outputDirectory}/skip`, "true\n");
  process.stdout.write(
    `Issue #${issueNumber} is not in the live ai:ready delivery state; skipped.\n`,
  );
  process.exit(0);
}
const labels = issue.labels.map((label) =>
  typeof label === "string" ? label : label.name,
);
const manualSource = labels.includes("source:manual");
let contractSource = issue.body ?? "";
if (manualSource) {
  if (!appBot) throw new Error("Missing trusted App Bot configuration");
  const comments = await listAll(
    GITHUB_REPOSITORY,
    GH_TOKEN,
    `issues/${issueNumber}/comments`,
  );
  const trustedComment = manualContractComment(comments, appBot);
  if (!trustedComment) {
    throw new Error("Manual Issue has no Contract from the trusted App Bot");
  }
  contractSource = trustedComment.body ?? "";
  if (
    mode === "--require-ready" &&
    !isCurrentManualRevision(issue, comments, appBot)
  ) {
    await writeFile(`${outputDirectory}/skip`, "true\n");
    process.stdout.write(
      `Issue #${issueNumber} has newer manual context than its Contract; skipped.\n`,
    );
    process.exit(0);
  }
} else if (!isTrustedIssueAuthor(issue, appBot)) {
  throw new Error("Issue Contract body was not published by a trusted author");
}

////////////////////////////////////////////////////
// Delivery 只接收已完成 Intake 且可从可信正文或 Manual App Bot 评论提取 Contract 的 Issue
////////////////////////////////////////////////////
if (!labels.includes("content:processed")) {
  throw new Error("Issue is not a processed SignalPatch Issue");
}
const match = contractSource.match(
  /<!-- signalpatch-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- signalpatch-contract:end -->/,
);
if (!match) {
  throw new Error("Issue does not contain a SignalPatch Issue Contract");
}
const contractText = match[1].trim();
const contract = JSON.parse(contractText);
if (manualSource) {
  if (
    contract.source?.kind !== "manual-issue" ||
    contract.source?.references?.length !== 1 ||
    contract.source.references[0] !== `manual-issue:${issue.number}`
  ) {
    throw new Error("Manual Contract source does not match the Issue");
  }
} else if (
  (contract.source?.kind === "feedback" &&
    (contract.source.references?.length !== 1 ||
      !contractSource.includes(
        `<!-- signalpatch-feedback:${contract.source.references[0]} -->`,
      ))) ||
  (contract.source?.kind === "codex-conversation" &&
    (contract.source.references?.length !== 1 ||
      contract.source.references[0] !==
        "conversation:explicit-user-confirmation" ||
      !contractSource.includes("<!-- signalpatch-conversation-request:"))) ||
  !["feedback", "codex-conversation"].includes(contract.source?.kind)
) {
  throw new Error("System Contract source does not match its trusted marker");
}

////////////////////////////////////////////////////
// 只把 Contract 与最小 Issue 元数据写入运行目录，不把整段不可信正文传给 Codex
////////////////////////////////////////////////////
await writeFile(`${outputDirectory}/contract.json`, `${contractText}\n`);
await writeFile(
  `${outputDirectory}/issue.json`,
  `${JSON.stringify(
    { number: issue.number, title: issue.title, url: issue.html_url },
    null,
    2,
  )}\n`,
);
