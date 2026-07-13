#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [logPath] = process.argv.slice(2);
if (!logPath) {
  throw new Error("Usage: classify-failure.mjs <failure-log>");
}
const log = (await readFile(logPath, "utf8")).toLowerCase();
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
