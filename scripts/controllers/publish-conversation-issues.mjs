#!/usr/bin/env node
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  assertConversationRequest,
  issueBodyForRequest,
  issueLabelsForRequest,
} from "./lib/conversation-issue.mjs";
import { requestJson, requireEnvironment } from "./lib/http.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const queueDirectory =
  process.env.SIGNALPATCH_CONVERSATION_QUEUE ??
  join(homedir(), ".signalpatch", "conversation-issue-queue");
const pendingDirectory = join(queueDirectory, "pending");
const processingDirectory = join(queueDirectory, "processing");
const completedDirectory = join(queueDirectory, "completed");
const failedDirectory = join(queueDirectory, "failed");
const lockPath = join(queueDirectory, "publisher.lock");
// ponytail: one local worker is enough; use a durable queue before adding publishers.

async function ensureDirectories() {
  await Promise.all(
    [
      pendingDirectory,
      processingDirectory,
      completedDirectory,
      failedDirectory,
    ].map((directory) => mkdir(directory, { recursive: true, mode: 0o750 })),
  );
}

async function movePendingRequests() {
  const files = (await readdir(pendingDirectory)).filter((file) =>
    file.endsWith(".json"),
  );
  for (const file of files.sort()) {
    await rename(join(pendingDirectory, file), join(processingDirectory, file));
  }
}

async function loadRequest(path) {
  return assertConversationRequest(JSON.parse(await readFile(path, "utf8")));
}

function headers(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };
}

async function findPublishedIssue(repository, token, requestId) {
  const marker = `signalpatch-conversation-request:${requestId}`;
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", `repo:${repository} in:body ${marker}`);
  const result = await requestJson(url, { headers: headers(token) });
  return result.items.find((item) => item.body?.includes(marker)) ?? null;
}

async function publishRequest(request, repository, token) {
  const existing = await findPublishedIssue(
    repository,
    token,
    request.requestId,
  );
  if (existing) {
    return existing;
  }
  return requestJson(`https://api.github.com/repos/${repository}/issues`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      title: `[SignalPatch] ${request.contract.problemSummary}`,
      body: issueBodyForRequest(request),
      labels: issueLabelsForRequest(request),
    }),
  });
}

async function complete(path, request, issue) {
  const receipt = {
    ...request,
    result: { issueNumber: issue.number, issueUrl: issue.html_url },
  };
  const destination = join(completedDirectory, `${request.requestId}.json`);
  await writeFile(
    `${destination}.tmp`,
    `${JSON.stringify(receipt, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o640,
      flag: "w",
    },
  );
  await rename(`${destination}.tmp`, destination);
  await rm(path);
}

await ensureDirectories();
let lock;
try {
  lock = await open(lockPath, "wx", 0o640);
} catch {
  throw new Error("Conversation Issue publisher is already running");
}

try {
  await movePendingRequests();
  const { GH_TOKEN, GITHUB_REPOSITORY } = requireEnvironment([
    "GH_TOKEN",
    "GITHUB_REPOSITORY",
  ]);
  const policy = await loadPolicy();
  const files = (await readdir(processingDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const path = join(processingDirectory, file);
    let request;
    try {
      request = await loadRequest(path);
    } catch (error) {
      await rename(path, join(failedDirectory, file));
      process.stderr.write(`${file}: ${error.message}\n`);
      continue;
    }
    request.contract.riskLevel = requiredRisk(
      policy,
      request.contract.allowedPaths,
      request.contract.riskLevel,
    );
    const issue = await publishRequest(request, GITHUB_REPOSITORY, GH_TOKEN);
    await complete(path, request, issue);
    process.stdout.write(
      `${JSON.stringify({ requestId: request.requestId, issueNumber: issue.number, issueUrl: issue.html_url })}\n`,
    );
  }
} finally {
  await lock?.close();
  await rm(lockPath, { force: true });
}
