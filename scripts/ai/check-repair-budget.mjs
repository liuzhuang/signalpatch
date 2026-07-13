#!/usr/bin/env node
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
