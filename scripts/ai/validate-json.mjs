#!/usr/bin/env node
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
const validate = ajv.compile(schema);
const valid = validate(data);
process.stdout.write(
  `${JSON.stringify({ valid, errors: validate.errors ?? [] })}\n`,
);
if (!valid) {
  process.exitCode = 1;
}
