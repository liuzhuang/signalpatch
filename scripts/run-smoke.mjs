#!/usr/bin/env node
// 【做什么】Playwright 冒烟测试入口：解析 base URL，跑 E2E（会写入 synthetic Feedback）
// 【何时跑】pnpm test:smoke；PR Gate 预览环境 Smoke、PR Outcome 生产 Smoke
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

////////////////////////////////////////////////////
// 同时兼容 --base-url=value 与 --base-url value，并把其余参数原样交给 Playwright
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// 使用当前 Node.js 进程运行项目锁定版本的 Playwright CLI，并继承测试退出码
////////////////////////////////////////////////////
const require = createRequire(import.meta.url);
const cli = require.resolve("@playwright/test/cli");
const result = spawnSync(process.execPath, [cli, "test", ...args], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
});
process.exit(result.status ?? 1);
