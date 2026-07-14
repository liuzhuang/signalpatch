#!/usr/bin/env node
// 【做什么】优先用本机 gh 直接发布已确认的 Issue Contract，否则写入 pending 队列
// 【何时跑】Codex Intake 确认后（AGENTS.md 授权的 workspace-write）；详见 enqueue 说明
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { newConversationRequest } from "./lib/conversation-issue.mjs";
import {
  dispatchIssueDelivery,
  publishContractIssue,
} from "./lib/issue-lifecycle.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const execFileAsync = promisify(execFile);
const directIssuePermissions = new Set(["WRITE", "MAINTAIN", "ADMIN"]);

const [contractPath] = process.argv.slice(2);
if (!contractPath) {
  throw new Error(
    "Usage: enqueue-conversation-issue.mjs <confirmed-issue-contract.json>",
  );
}

const queueDirectory =
  process.env.SIGNALPATCH_CONVERSATION_QUEUE ??
  join(homedir(), ".signalpatch", "conversation-issue-queue");
const pendingDirectory = join(queueDirectory, "pending");
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const request = newConversationRequest(contract);

async function ghAccess() {
  const repositoryArguments = process.env.GITHUB_REPOSITORY
    ? [process.env.GITHUB_REPOSITORY]
    : [];
  try {
    const { stdout: repositoryInfo } = await execFileAsync(
      "gh",
      [
        "repo",
        "view",
        ...repositoryArguments,
        "--json",
        "nameWithOwner,viewerPermission",
        "--jq",
        '.nameWithOwner + "\\t" + .viewerPermission',
      ],
      { encoding: "utf8", timeout: 5_000 },
    );
    const [repository, permission] = repositoryInfo.trim().split("\t");
    if (!repository || !directIssuePermissions.has(permission)) return null;

    const { stdout: token } = await execFileAsync(
      "gh",
      ["auth", "token", "--hostname", "github.com"],
      { encoding: "utf8", timeout: 5_000 },
    );
    return { repository, token: token.trim() || null };
  } catch {
    return null;
  }
}

async function publishDirectly() {
  const access = await ghAccess();
  if (!access?.token) return null;

  const policy = await loadPolicy();
  request.contract.riskLevel = requiredRisk(
    policy,
    request.contract.allowedPaths,
    request.contract.riskLevel,
  );
  const result = await publishContractIssue({
    repository: access.repository,
    token: access.token,
    contract: request.contract,
    idempotencyMarker: `signalpatch-conversation-request:${request.requestId}`,
  });
  if (!result.duplicate) {
    await dispatchIssueDelivery(
      access.repository,
      access.token,
      result.issue.number,
    );
  }
  return result;
}

const directResult = await publishDirectly();
if (directResult) {
  process.stdout.write(
    `${JSON.stringify({
      requestId: request.requestId,
      state: "CREATED_DIRECT",
      issueNumber: directResult.issue.number,
      issueUrl: directResult.issue.html_url,
      duplicateOf: directResult.duplicate?.number ?? null,
    })}\n`,
  );
} else {
  const destination = join(pendingDirectory, `${request.requestId}.json`);
  const temporary = `${destination}.tmp`;

  ////////////////////////////////////////////////////
  // gh 不可用、未登录或没有 Issue 写权限时，才回退到本地待发布队列
  ////////////////////////////////////////////////////
  await mkdir(dirname(destination), { recursive: true, mode: 0o750 });
  await writeFile(temporary, `${JSON.stringify(request, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o640,
    flag: "wx",
  });

  ////////////////////////////////////////////////////
  // 临时文件完整写入后再原子重命名，防止发布器读到半份 JSON
  ////////////////////////////////////////////////////
  await rename(temporary, destination);
  process.stdout.write(
    `${JSON.stringify({ requestId: request.requestId, state: "QUEUED" })}\n`,
  );
}
