#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { newConversationRequest } from "./lib/conversation-issue.mjs";

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
const destination = join(pendingDirectory, `${request.requestId}.json`);
const temporary = `${destination}.tmp`;

////////////////////////////////////////////////////
// Codex 只写本地待发布队列，不读取外部凭据，也不直接调用 GitHub API
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
