#!/usr/bin/env node
import { createHash } from "node:crypto";

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}

////////////////////////////////////////////////////
// 清除颜色、运行时标识、本机路径和常见凭据后再计算摘要，使同一根因得到稳定指纹
////////////////////////////////////////////////////
const normalized = input
  .replace(/\x1b\[[0-9;]*m/g, "")
  .replace(/\b[0-9a-f]{40}\b/gi, "<sha>")
  .replace(/\b\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?\b/g, "<timestamp>")
  .replace(/\/Users\/[^\s:]+/g, "<workspace>")
  .replace(/\/home\/[^\s:]+/g, "<workspace>")
  .replace(/(?:ghp|github_pat|vercel|sb_secret)_[A-Za-z0-9_-]+/gi, "<redacted>")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>")
  .replace(/\s+/g, " ")
  .trim();
const fingerprint = createHash("sha256").update(normalized).digest("hex");

////////////////////////////////////////////////////
// 指纹使用完整规范化日志，交给 Repair 的摘要则限制为 12000 字符
////////////////////////////////////////////////////
const summary = normalized.slice(0, 12_000);
process.stdout.write(
  `${JSON.stringify({ fingerprint, summary, truncated: summary.length < normalized.length })}\n`,
);
