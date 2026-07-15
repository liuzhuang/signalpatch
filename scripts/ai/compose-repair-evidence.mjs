#!/usr/bin/env node
// 【做什么】把有界失败摘要与独立 Reviewer 的结构化 finding 合成为 Repair evidence
// 【何时跑】pr-outcome.yml collect-failure Job；Reviewer artifact 缺失时仍保留普通失败摘要
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireStringValue(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function normalizeFingerprintText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function compareCanonical(left, right) {
  const leftValue = JSON.stringify(left);
  const rightValue = JSON.stringify(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

////////////////////////////////////////////////////
// 只投影 delivery-output Schema 中 Repair 真正需要的字段，避免把 Artifact 的额外内容带进 Prompt
////////////////////////////////////////////////////
export function composeRepairEvidence(failureValue, reviewerValue) {
  const failure = requireObject(failureValue, "failure evidence");
  const result = {
    fingerprint: requireString(failure.fingerprint, "failure fingerprint"),
    summary: requireString(failure.summary, "failure summary"),
    truncated: Boolean(failure.truncated),
    reviewer: null,
  };

  if (reviewerValue === undefined || reviewerValue === null) return result;

  const reviewer = requireObject(reviewerValue, "Reviewer evidence");
  const projectedReviewer = {
    stage: requireString(reviewer.stage, "Reviewer stage"),
    summary: requireString(reviewer.summary, "Reviewer summary"),
    changedPaths: Array.isArray(reviewer.changedPaths)
      ? reviewer.changedPaths.filter((path) => typeof path === "string")
      : [],
    verification: Array.isArray(reviewer.verification)
      ? reviewer.verification.map((entry) => ({
          command: requireString(entry.command, "verification command"),
          status: requireString(entry.status, "verification status"),
          detail: requireStringValue(entry.detail, "verification detail"),
        }))
      : [],
    riskLevel: requireString(reviewer.riskLevel, "Reviewer risk level"),
    decision: requireString(reviewer.decision, "Reviewer decision"),
    findings: Array.isArray(reviewer.findings)
      ? reviewer.findings.map((finding) => ({
          severity: requireString(finding.severity, "finding severity"),
          title: requireString(finding.title, "finding title"),
          evidence: requireString(finding.evidence, "finding evidence"),
        }))
      : [],
  };
  result.reviewer = projectedReviewer;
  if (projectedReviewer.decision === "APPROVE") return result;

  // Reviewer 拒绝的 shell 退出日志几乎相同；只用规范化且排序后的根因字段区分 finding。
  // summary、verification 和数组原顺序不参与，避免同一根因因非关键措辞或排序变化绕过重复保护。
  const reviewerFingerprint = {
    decision: projectedReviewer.decision,
    findings: projectedReviewer.findings
      .map((finding) => ({
        severity: finding.severity,
        title: normalizeFingerprintText(finding.title),
        evidence: normalizeFingerprintText(finding.evidence),
      }))
      .sort(compareCanonical),
  };
  result.fingerprint = createHash("sha256")
    .update(`${result.fingerprint}\n${JSON.stringify(reviewerFingerprint)}`)
    .digest("hex");
  return result;
}

async function main() {
  const [failurePath, reviewerPath] = process.argv.slice(2);
  if (!failurePath) {
    throw new Error(
      "Usage: compose-repair-evidence.mjs <failure.json> [review.json]",
    );
  }
  const failure = JSON.parse(await readFile(failurePath, "utf8"));
  const reviewer =
    reviewerPath && existsSync(reviewerPath)
      ? JSON.parse(await readFile(reviewerPath, "utf8"))
      : undefined;
  process.stdout.write(
    `${JSON.stringify(composeRepairEvidence(failure, reviewer))}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
