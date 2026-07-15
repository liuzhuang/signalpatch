# SignalPatch

SignalPatch 是 GitHub Issue、Codex 自动开发、PR 修复、验收和发布流程的参考项目。最小应用只负责产生真实 Feedback、提供可修改代码，并显示发布后的 Repair Status。

## Language

**Feedback**:
真实用户在应用内提交的问题、建议或负面体验记录；内容可以很少，它是问题证据，不等同于可执行需求。
_Avoid_: Issue, Requirement, Ticket

**Feedback Context**:
应用在 Feedback 提交时自动附带的脱敏运行信息，用于定位会话、版本、功能和请求轨迹，并支持系统补齐问题证据。
_Avoid_: Full Conversation, User Profile, GitHub Issue Body

**Problem**:
一个或多个 Feedback 经脱敏、去重和归类后指向的同一可处理问题；它可以尚未达到创建 GitHub Issue 的条件。
_Avoid_: Feedback, GitHub Issue, Bug Report

**Repair Status**:
Feedback 对应问题当前所处的处理阶段，面向原始反馈用户展示。
_Avoid_: Issue Status, Workflow State

**Automation Run**:
一个 GitHub Issue 从评估、构建、PR 验收、自动修复到发布终态的完整执行记录。
_Avoid_: Codex Session, Workflow Job, Deployment

**Tracking ID**:
Feedback 提交成功后返回的不可预测标识，用于匿名查询 Repair Status，不代表用户身份或 GitHub Issue 编号。
_Avoid_: User ID, Issue Number, Session ID

**Issue Contract**:
Problem 达到自动开发条件后写入 GitHub Issue 的统一执行契约，包含来源、问题证据、验收标准、允许修改范围、风险等级、运行时验收和脱敏声明。
_Avoid_: Raw Feedback, Conversation Summary, Free-form Issue

**SPEC_READY**:
Problem 已表达可识别的产品变更方向，并已由 Intake 结合脱敏上下文和仓库现状补齐实际与预期行为、可验证证据、带验证器的验收标准、修改范围、风险等级和脱敏结果，可以创建 Issue Contract 并进入自动开发。提交者不需要预先给出实现机制、断点或 Validator。
_Avoid_: Feedback Received, Issue Opened, Ready to Merge
