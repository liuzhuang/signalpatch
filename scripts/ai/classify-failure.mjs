#!/usr/bin/env node
// 【做什么】把失败日志分为 configuration（自动化配置）、infrastructure（Runner/网络）或 application（代码/测试）
// 【何时跑】pr-outcome.yml collect-failure Job
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

////////////////////////////////////////////////////
// 缺失脚本先归为配置错误；其余只把明确的瞬态异常归为基础设施，默认交给应用 Repair
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
const configurationPatterns = ["err_pnpm_no_script"];

export function classifyFailure(log) {
  const normalized = log.toLowerCase();
  const configurationMatches = configurationPatterns.filter((pattern) =>
    normalized.includes(pattern),
  );
  if (/^npm (?:error|err!) missing script:/m.test(normalized)) {
    configurationMatches.push("missing script:");
  }
  if (
    normalized.includes("err_pnpm_recursive_exec_first_fail") &&
    /command "[^"\n]+" not found/.test(normalized)
  ) {
    configurationMatches.push(
      "err_pnpm_recursive_exec_first_fail: command not found",
    );
  }
  if (configurationMatches.length > 0) {
    return { kind: "configuration", matched: configurationMatches };
  }

  const matched = infrastructurePatterns.filter((pattern) =>
    normalized.includes(pattern),
  );
  return {
    kind: matched.length > 0 ? "infrastructure" : "application",
    matched,
  };
}

async function main() {
  const [logPath] = process.argv.slice(2);
  if (!logPath) {
    throw new Error("Usage: classify-failure.mjs <failure-log>");
  }
  const log = await readFile(logPath, "utf8");
  process.stdout.write(`${JSON.stringify(classifyFailure(log))}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
