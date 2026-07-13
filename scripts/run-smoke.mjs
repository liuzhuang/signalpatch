#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const baseUrlIndex = args.findIndex((argument) =>
  argument.startsWith("--base-url"),
);
let baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (baseUrlIndex !== -1) {
  const argument = args[baseUrlIndex];
  if (argument.includes("=")) {
    baseURL = argument.slice(argument.indexOf("=") + 1);
    args.splice(baseUrlIndex, 1);
  } else {
    baseURL = args[baseUrlIndex + 1];
    args.splice(baseUrlIndex, 2);
  }
}
if (!baseURL) {
  baseURL = "http://127.0.0.1:3000";
}

const require = createRequire(import.meta.url);
const cli = require.resolve("playwright/cli");
const result = spawnSync(process.execPath, [cli, "test", ...args], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
});
process.exit(result.status ?? 1);
