# Tracking ID 首尾空格验收规格

该规格故意不进入初始版本的 `pnpm verify`。它是首个端到端自动 Repair 任务的独立验收输入。

- 原始 Tracking ID 可以查询 Repair Status。
- 同一 Tracking ID 增加首尾空格后返回相同 Repair Status。
- 不存在的 Tracking ID 仍返回 `404`。
- 修复范围仅限 Status API、Tracking ID 规范化模块和测试。
