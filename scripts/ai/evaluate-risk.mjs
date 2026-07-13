#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { loadPolicy, requiredRisk } from "./lib/policy.mjs";

const [proposedRisk, pathsFile, policyFile = ".ai/policy.yaml"] =
  process.argv.slice(2);
if (!proposedRisk || !pathsFile) {
  throw new Error(
    "Usage: evaluate-risk.mjs <R0|R1|R2|R3> <paths-file> [policy-file]",
  );
}

const paths = (await readFile(pathsFile, "utf8"))
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const policy = await loadPolicy(policyFile);
const riskLevel = requiredRisk(policy, paths, proposedRisk);

process.stdout.write(`${JSON.stringify({ proposedRisk, riskLevel, paths })}\n`);
