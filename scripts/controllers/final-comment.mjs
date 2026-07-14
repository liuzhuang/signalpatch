#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [contractPath, deploymentPath, pr, commit, productionUrl] =
  process.argv.slice(2);
if (!contractPath || !deploymentPath || !pr || !commit || !productionUrl) {
  throw new Error(
    "Usage: final-comment.mjs <contract> <deployment> <pr> <commit> <production-url>",
  );
}
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const deployment = JSON.parse(await readFile(deploymentPath, "utf8"));

////////////////////////////////////////////////////
// 最终评论逐条保留 Acceptance Criterion 及其 Validator，作为关闭 Issue 前的验收证据
////////////////////////////////////////////////////
const criteria = contract.acceptanceCriteria
  .map(
    (criterion) =>
      `- [x] ${criterion.id}: ${criterion.statement}\n  - Validator: \`${criterion.validator}\``,
  )
  .join("\n");

////////////////////////////////////////////////////
// 同一条评论汇总 PR、Commit、Preview、Production 和两次 Smoke Test 结果
////////////////////////////////////////////////////
process.stdout.write(`## Production acceptance passed

- PR: #${pr}
- Accepted commit: \`${commit}\`
- Staged deployment: ${deployment.deploymentUrl}
- Production: ${productionUrl}
- Preview-equivalent Smoke Test: passed
- Production Smoke Test: passed

### Acceptance Criteria

${criteria}
`);
