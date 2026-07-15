#!/usr/bin/env node
// 【做什么】更新 Issue Delivery 的可见状态，并复用一条评论记录 Codex 开始/结束时间
// 【何时跑】Issue Delivery 的 Controller Job；Codex 进程本身不接触 GitHub 凭据
import { fileURLToPath } from "node:url";
import { appendFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import { claimIssueForDelivery } from "./lib/issue-lifecycle.mjs";

export const progressMarker = "<!-- signalpatch-delivery-progress -->";

export function extractStartedAt(body) {
  return body.match(/- 开始时间（UTC）：([^\n]+)/)?.[1] ?? "未知";
}

/**
 * @param {{ startedAt: string, finishedAt?: string | null, result?: string, runUrl: string }} options
 */
export function progressComment({
  startedAt,
  finishedAt = null,
  result = "success",
  runUrl,
}) {
  const finished = finishedAt
    ? `- Codex 结束时间（UTC）：${finishedAt}`
    : "- Codex 结束时间（UTC）：执行中";
  const status = finishedAt
    ? result === "success"
      ? "Codex 执行完成，进入验证"
      : "Codex 执行结束，但本轮未成功，需要人工处理"
    : "Codex 执行中";
  return [
    progressMarker,
    "## Issue Delivery 进度",
    `- 状态：${status}`,
    `- 开始时间（UTC）：${startedAt}`,
    finished,
    `- Workflow Run：${runUrl}`,
  ].join("\n");
}

function headers(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };
}

function issueUrl(repository, issueNumber) {
  return `https://api.github.com/repos/${repository}/issues/${issueNumber}`;
}

async function listComments(repository, token, issueNumber) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`${issueUrl(repository, issueNumber)}/comments`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const batch = await requestJson(url, { headers: headers(token) });
    comments.push(...batch);
    if (batch.length < 100) return comments;
  }
}

async function updateLabels(repository, token, issueNumber, add, remove) {
  const issue = await requestJson(issueUrl(repository, issueNumber), {
    headers: headers(token),
  });
  const labels = new Set(
    issue.labels.map((label) =>
      typeof label === "string" ? label : label.name,
    ),
  );
  for (const label of remove) labels.delete(label);
  for (const label of add) labels.add(label);
  await requestJson(issueUrl(repository, issueNumber), {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ labels: [...labels] }),
  });
}

export function trustedProgressComment(comments, trustedBotLogin) {
  return comments.find(
    (comment) =>
      comment.user?.type === "Bot" &&
      comment.user?.login === trustedBotLogin &&
      comment.body?.includes(progressMarker),
  );
}

async function upsertProgressComment(
  repository,
  token,
  issueNumber,
  body,
  trustedBotLogin,
) {
  const existing = trustedProgressComment(
    await listComments(repository, token, issueNumber),
    trustedBotLogin,
  );
  const url = existing
    ? `https://api.github.com/repos/${repository}/issues/comments/${existing.id}`
    : `${issueUrl(repository, issueNumber)}/comments`;
  const comment = await requestJson(url, {
    method: existing ? "PATCH" : "POST",
    headers: headers(token),
    body: JSON.stringify({ body }),
  });
  if (comment.user?.type !== "Bot" || comment.user?.login !== trustedBotLogin) {
    throw new Error("Delivery progress was not written by the trusted App Bot");
  }
  return comment;
}

async function main() {
  const [phase, issueNumber, detail = "success"] = process.argv.slice(2);
  if (!phase || !issueNumber || !["start", "end"].includes(phase)) {
    throw new Error(
      "Usage: issue-progress.mjs start <issue-number> <contract-digest> | end <issue-number> [success|failure|cancelled]",
    );
  }
  const { GH_TOKEN, GITHUB_REPOSITORY, SIGNALPATCH_APP_BOT } =
    requireEnvironment([
      "GH_TOKEN",
      "GITHUB_REPOSITORY",
      "SIGNALPATCH_APP_BOT",
    ]);
  const runId = process.env.GITHUB_RUN_ID ?? "unknown";
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = `${serverUrl}/${GITHUB_REPOSITORY}/actions/runs/${runId}`;
  const now = new Date().toISOString();

  if (phase === "start") {
    if (!/^[0-9a-f]{64}$/i.test(detail)) {
      throw new Error("start requires the prepared Contract SHA-256 digest");
    }
    const claim = await claimIssueForDelivery({
      repository: GITHUB_REPOSITORY,
      token: GH_TOKEN,
      issueNumber,
      expectedContractDigest: detail.toLowerCase(),
      trustedBotLogin: SIGNALPATCH_APP_BOT,
    });
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `started=${String(claim.started)}\n`,
      );
    }
    if (!claim.started) {
      process.stdout.write(
        `${JSON.stringify({ phase, issueNumber, started: false, reason: claim.reason, timestamp: now })}\n`,
      );
      return;
    }
    try {
      await upsertProgressComment(
        GITHUB_REPOSITORY,
        GH_TOKEN,
        issueNumber,
        progressComment({ startedAt: now, runUrl }),
        SIGNALPATCH_APP_BOT,
      );
    } catch (error) {
      await updateLabels(
        GITHUB_REPOSITORY,
        GH_TOKEN,
        issueNumber,
        ["ai:human-required"],
        ["ai:building", "ai:ready"],
      );
      throw error;
    }
  } else {
    const comments = await listComments(
      GITHUB_REPOSITORY,
      GH_TOKEN,
      issueNumber,
    );
    const progress = trustedProgressComment(comments, SIGNALPATCH_APP_BOT);
    const startedAt = extractStartedAt(progress?.body ?? "");
    const successful = detail === "success";
    await updateLabels(
      GITHUB_REPOSITORY,
      GH_TOKEN,
      issueNumber,
      successful ? ["ai:verifying"] : ["ai:human-required"],
      ["ai:building"],
    );
    await upsertProgressComment(
      GITHUB_REPOSITORY,
      GH_TOKEN,
      issueNumber,
      progressComment({
        startedAt,
        finishedAt: now,
        result: detail,
        runUrl,
      }),
      SIGNALPATCH_APP_BOT,
    );
  }

  process.stdout.write(
    `${JSON.stringify({ phase, issueNumber, result: detail, timestamp: now })}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
