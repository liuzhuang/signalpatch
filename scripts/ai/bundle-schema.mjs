#!/usr/bin/env node
// 【做什么】把 JSON Schema 的 $ref 内联成单文件，供 Codex CLI 的 output-schema 使用
// 【何时跑】feedback-intake.yml 的 qualify Job
import { readFile } from "node:fs/promises";

const [rootPath, referencedPath] = process.argv.slice(2);
if (!rootPath || !referencedPath) {
  throw new Error(
    "Usage: bundle-schema.mjs <root-schema.json> <referenced-schema.json>",
  );
}
const root = JSON.parse(await readFile(rootPath, "utf8"));
const referenced = JSON.parse(await readFile(referencedPath, "utf8"));

////////////////////////////////////////////////////
// 递归内联与目标 $id 完全匹配的 Schema，同时移除只属于独立文档的元数据
////////////////////////////////////////////////////
function replace(value) {
  if (Array.isArray(value)) {
    return value.map(replace);
  }
  if (value && typeof value === "object") {
    if (value.$ref === referenced.$id) {
      const embedded = { ...referenced };
      delete embedded.$id;
      delete embedded.$schema;
      return replace(embedded);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replace(child)]),
    );
  }
  return value;
}

process.stdout.write(`${JSON.stringify(replace(root), null, 2)}\n`);
