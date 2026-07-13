# 不保存完整用户会话

SignalPatch 只保存脱敏后的输入/输出片段、结构化 Feedback Context 和不可逆引用；完整会话仍由来源应用按自身策略管理，GitHub Issue 只接收脱敏证据。这样会限制 Evidence Agent 可直接读取的内容，但避免 SignalPatch 和 GitHub 成为用户会话数据库。
