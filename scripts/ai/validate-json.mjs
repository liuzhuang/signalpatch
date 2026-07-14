#!/usr/bin/env node
// 【做什么】用 Ajv 校验 JSON 是否符合指定 Schema（Intake 输出、Delivery 输出、Contract 等）
// 【何时跑】多个 Workflow 在 Codex 输出或 Contract 提取后
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const [schemaPath, dataPath] = process.argv.slice(2);
if (!schemaPath || !dataPath) {
  throw new Error("Usage: validate-json.mjs <schema.json> <data.json>");
}

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const data = JSON.parse(await readFile(dataPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });

////////////////////////////////////////////////////
// 预加载同目录中带 $id 的 Schema，使根 Schema 可以解析本地跨文件引用
////////////////////////////////////////////////////
for (const file of await readdir(dirname(schemaPath))) {
  if (
    file.endsWith(".schema.json") &&
    join(dirname(schemaPath), file) !== schemaPath
  ) {
    const referencedSchema = JSON.parse(
      await readFile(join(dirname(schemaPath), file), "utf8"),
    );
    if (referencedSchema.$id) {
      ajv.addSchema(referencedSchema);
    }
  }
}

////////////////////////////////////////////////////
// 输出全部校验错误供控制器和 Repair 使用，并用非零退出码阻断后续阶段
////////////////////////////////////////////////////
const validate = ajv.compile(schema);
const valid = validate(data);
process.stdout.write(
  `${JSON.stringify({ valid, errors: validate.errors ?? [] })}\n`,
);
if (!valid) {
  process.exitCode = 1;
}
