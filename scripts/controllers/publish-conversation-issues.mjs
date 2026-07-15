#!/usr/bin/env node
// 【做什么】消费本地对话队列，发布 raw Issue，去重后晋升 processed
// 【何时跑】publish-conversation-issues.yml；亦可本地手动（需 GH_TOKEN）
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

import { assertConversationRequest } from "./lib/conversation-issue.mjs";
import { requireEnvironment } from "./lib/http.mjs";
import { publishContractIssue } from "./lib/issue-lifecycle.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const queueDirectory =
  process.env.SIGNALPATCH_CONVERSATION_QUEUE ??
  join(homedir(), ".signalpatch", "conversation-issue-queue");
const pendingDirectory = join(queueDirectory, "pending");
const processingDirectory = join(queueDirectory, "processing");
const completedDirectory = join(queueDirectory, "completed");
const failedDirectory = join(queueDirectory, "failed");
const lockPath = join(queueDirectory, "publisher.lock");

////////////////////////////////////////////////////
// ponytail: 单个本地发布器已满足当前吞吐量；需要多发布器时再迁移到持久队列
////////////////////////////////////////////////////

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
  ////////////////////////////////////////////////////
  // 先把待处理文件移入 processing，进程重启后可以继续处理而不会丢失请求
  ////////////////////////////////////////////////////
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

async function publishRequest(request, repository, token, trustedBotLogin) {
  return publishContractIssue({
    repository,
    token,
    contract: request.contract,
    idempotencyMarker: `signalpatch-conversation-request:${request.requestId}`,
    trustedBotLogin,
  });
}

async function complete(path, request, result) {
  ////////////////////////////////////////////////////
  // 回执先原子写入 completed，再删除 processing 文件，成功结果因此可审计
  ////////////////////////////////////////////////////
  const receipt = {
    ...request,
    result: {
      issueNumber: result.issue.number,
      issueUrl: result.issue.html_url,
      duplicateOf: result.duplicate?.number ?? null,
    },
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
  ////////////////////////////////////////////////////
  // 排他创建锁文件，保证一个队列目录同一时刻只有一个发布器执行外部写操作
  ////////////////////////////////////////////////////
  lock = await open(lockPath, "wx", 0o640);
} catch {
  throw new Error("Conversation Issue publisher is already running");
}

try {
  await movePendingRequests();
  const { GH_TOKEN, GITHUB_REPOSITORY, SIGNALPATCH_APP_BOT } =
    requireEnvironment([
      "GH_TOKEN",
      "GITHUB_REPOSITORY",
      "SIGNALPATCH_APP_BOT",
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
      ////////////////////////////////////////////////////
      // 无效或被篡改的队列文件移入 failed，不阻塞同批次中的其他合法请求
      ////////////////////////////////////////////////////
      await rename(path, join(failedDirectory, file));
      process.stderr.write(`${file}: ${error.message}\n`);
      continue;
    }

    ////////////////////////////////////////////////////
    // 发布身份持有凭据，但仍需重新校验 Contract，并在调用 GitHub 前只上调风险
    ////////////////////////////////////////////////////
    request.contract.riskLevel = requiredRisk(
      policy,
      request.contract.allowedPaths,
      request.contract.riskLevel,
    );
    const result = await publishRequest(
      request,
      GITHUB_REPOSITORY,
      GH_TOKEN,
      SIGNALPATCH_APP_BOT,
    );
    await complete(path, request, result);
    process.stdout.write(
      `${JSON.stringify({ requestId: request.requestId, issueNumber: result.issue.number, issueUrl: result.issue.html_url, duplicateOf: result.duplicate?.number ?? null })}\n`,
    );
  }
} finally {
  await lock?.close();
  await rm(lockPath, { force: true });
}
