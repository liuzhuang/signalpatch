#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";

const [issueNumber, outputDirectory = ".ai/runs/delivery"] =
  process.argv.slice(2);
if (!issueNumber) {
  throw new Error("Usage: prepare-issue.mjs <issue-number> [output-directory]");
}
const { GH_TOKEN, GITHUB_REPOSITORY } = requireEnvironment([
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
]);
const issue = await requestJson(
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}`,
  {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${GH_TOKEN}`,
      "x-github-api-version": "2022-11-28",
    },
  },
);
if (!issue.labels.some((label) => label.name.startsWith("ai:"))) {
  throw new Error("Issue does not have a SignalPatch automation label");
}
const match = issue.body?.match(
  /<!-- signalpatch-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- signalpatch-contract:end -->/,
);
if (!match) {
  throw new Error("Issue does not contain a SignalPatch Issue Contract");
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(`${outputDirectory}/contract.json`, `${match[1].trim()}\n`);
await writeFile(
  `${outputDirectory}/issue.json`,
  `${JSON.stringify(
    { number: issue.number, title: issue.title, url: issue.html_url },
    null,
    2,
  )}\n`,
);
