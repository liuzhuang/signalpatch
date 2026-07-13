#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

const directory = ".github/workflows";
const expected = [
  "feedback-intake.yml",
  "issue-delivery.yml",
  "pr-gate.yml",
  "pr-outcome.yml",
];
const files = (await readdir(directory)).filter((file) =>
  file.endsWith(".yml"),
);
const errors = [];

for (const name of expected) {
  if (!files.includes(name)) {
    errors.push(`${name}: missing workflow`);
  }
}
for (const file of files) {
  const source = await readFile(join(directory, file), "utf8");
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    errors.push(`${file}: invalid YAML: ${error.message}`);
    continue;
  }
  if (!workflow.name || !workflow.on || !workflow.jobs) {
    errors.push(`${file}: name, on, and jobs are required`);
    continue;
  }
  if (/\b(?:write-all|read-all)\b/.test(source)) {
    errors.push(`${file}: broad permission shortcut is forbidden`);
  }
  if (file !== "pr-outcome.yml" && source.includes("workflow_run:")) {
    errors.push(`${file}: workflow_run is only allowed in pr-outcome.yml`);
  }
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    const jobSource = JSON.stringify(job);
    const codexJob = jobSource.includes("codex exec");
    if (codexJob) {
      for (const forbidden of [
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "SIGNALPATCH_APP_PRIVATE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "VERCEL_TOKEN",
      ]) {
        if (jobSource.includes(forbidden)) {
          errors.push(`${file}:${jobName}: Codex job references ${forbidden}`);
        }
      }
      if (jobSource.includes("create-github-app-token")) {
        errors.push(
          `${file}:${jobName}: Codex and GitHub App token share a job`,
        );
      }
      if (jobSource.includes("danger-full-access")) {
        errors.push(`${file}:${jobName}: danger-full-access is forbidden`);
      }
      const checkout = job.steps?.find((step) =>
        String(step.uses ?? "").startsWith("actions/checkout@"),
      );
      if (!checkout || checkout.with?.["persist-credentials"] !== false) {
        errors.push(
          `${file}:${jobName}: Codex checkout must disable persisted credentials`,
        );
      }
    }
    if (
      jobSource.includes("VERCEL_TOKEN") &&
      jobSource.includes("codex exec")
    ) {
      errors.push(
        `${file}:${jobName}: deployment credentials and Codex share a job`,
      );
    }
    for (const step of job.steps ?? []) {
      if (
        step.uses &&
        !String(step.uses).startsWith("./") &&
        !/@[0-9a-f]{40}$/.test(String(step.uses).split(" #")[0])
      ) {
        errors.push(
          `${file}:${jobName}: action is not pinned to a full SHA: ${step.uses}`,
        );
      }
    }
  }
}

const valid = errors.length === 0;
process.stdout.write(
  `${JSON.stringify({ valid, files: files.sort(), errors }, null, 2)}\n`,
);
if (!valid) {
  process.exitCode = 1;
}
