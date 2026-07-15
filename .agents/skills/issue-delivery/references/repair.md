# Repair stage

<!--
  本文件只在 --stage repair 时进入 Prompt。当前分支保留已有修改，Controller 另传归一化失败摘要与
  Failure Fingerprint；Workflow 在调用 Codex 前先检查次数和重复指纹，调用后再校验有效 Diff。
-->

Use a `workspace-write` sandbox with no external write credentials. Inputs are limited to the Issue Contract, current diff, normalized failure summary, Failure Fingerprint, previous change summary, allowed paths, and attempt number.

Reproduce the current failure and make one focused correction. Run the narrowest reproducible validator that does not require a local server, browser, or Sandbox network access, then follow the shared verification rule before returning `APPROVE`. Add runtime coverage when the Contract requires it, but leave execution to the Controller acceptance jobs. Stop without editing when the same Failure Fingerprint appears twice, the failure is infrastructure-only after one retry, no effective change is possible, the next change crosses allowed paths, risk becomes R2 or R3, or the attempt exceeds three.
