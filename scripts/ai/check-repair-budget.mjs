#!/usr/bin/env node
// 【做什么】检查 Repair 尝试次数（≤3）、是否重复失败指纹、是否有有效代码改动
// 【何时跑】pr-outcome.yml repair Job，调用 Codex 前
const [
  attemptValue,
  fingerprint,
  previousFingerprint = "",
  changedValue = "1",
] = process.argv.slice(2);
const attempt = Number(attemptValue);
const changedFiles = Number(changedValue);

let allowed = true;
let reason = "repair-allowed";

////////////////////////////////////////////////////
// 依次阻止越界尝试、重复失败和无有效修改，保证自动 Repair 最多执行三轮
////////////////////////////////////////////////////
if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) {
  allowed = false;
  reason = "repair-attempt-out-of-range";
} else if (fingerprint && fingerprint === previousFingerprint) {
  allowed = false;
  reason = "repeated-failure-fingerprint";
} else if (changedFiles === 0 && attempt > 1) {
  allowed = false;
  reason = "no-effective-change";
}

process.stdout.write(`${JSON.stringify({ allowed, reason, attempt })}\n`);
if (!allowed) {
  process.exitCode = 1;
}
