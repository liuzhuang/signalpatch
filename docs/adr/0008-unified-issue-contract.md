# 两类来源使用统一 Issue Contract

Codex 多轮对话和应用内 Feedback 先形成 Problem，只有达到 `SPEC_READY` 才创建用于自动开发的 GitHub Issue。Issue Contract 统一包含来源引用、问题摘要、实际与预期行为、脱敏证据、复现方法、带验证器的验收标准、非目标、允许修改范围、风险等级、运行时验收和隐私声明。

Codex 对话来源在创建 Issue 前必须获得用户一次明确确认。应用 Feedback 不要求原始用户确认；当内容很少时，由 Evidence Agent 使用脱敏的 Feedback Context 和只读仓库现状补齐目标文件、合理默认值、验收边界和 Validator，也可以聚合多个 Feedback。产品变更方向明确时，不因缺少截图、CSS 机制、逐元素范围或断点数值而要求补充上下文；只有输入不是产品意见、与本产品无关或完全没有可识别的产品结果时，才保留为 Problem 而不触发代码修改。
