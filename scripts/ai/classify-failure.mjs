#!/usr/bin/env node
// 【做什么】把失败日志分为 infrastructure（Runner/网络）或 application（代码/测试）
// 【何时跑】pr-outcome.yml collect-failure Job
import { readFile } from "node:fs/promises";

const [logPath] = process.argv.slice(2);
if (!logPath) {
  throw new Error("Usage: classify-failure.mjs <failure-log>");
}
const log = (await readFile(logPath, "utf8")).toLowerCase();

////////////////////////////////////////////////////
// 只把可短暂恢复的 Runner、网络和服务异常归为基础设施故障，其余交给应用 Repair
////////////////////////////////////////////////////
const infrastructurePatterns = [
  "runner lost communication",
  "the operation was canceled",
  "econnreset",
  "socket hang up",
  "service unavailable",
  "failed to download action",
  "temporary failure in name resolution",
];
const matched = infrastructurePatterns.filter((pattern) =>
  log.includes(pattern),
);
const kind = matched.length > 0 ? "infrastructure" : "application";
process.stdout.write(`${JSON.stringify({ kind, matched })}\n`);
