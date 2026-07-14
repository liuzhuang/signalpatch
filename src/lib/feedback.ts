const MAX_MESSAGE_LENGTH = 2_000;

////////////////////////////////////////////////////
// Feedback Context 只接受定位问题所需的五个脱敏字段，其他客户端字段一律忽略
////////////////////////////////////////////////////
const contextKeys = [
  "feature",
  "route",
  "commitSha",
  "errorCode",
  "occurredAt",
] as const;

export type FeedbackContext = Partial<
  Record<(typeof contextKeys)[number], string>
>;

export interface FeedbackInput {
  message: string;
  context: FeedbackContext;
}

////////////////////////////////////////////////////
// 在数据库调用前校验不可信输入，并去除 Feedback 正文首尾空白
////////////////////////////////////////////////////
export function parseFeedbackInput(value: unknown): FeedbackInput {
  if (!value || typeof value !== "object") {
    throw new Error("Feedback 请求格式有误");
  }

  const candidate = value as Record<string, unknown>;
  const message =
    typeof candidate.message === "string" ? candidate.message.trim() : "";
  if (!message) {
    throw new Error("Feedback 内容不能为空");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Feedback 内容不能超过 ${MAX_MESSAGE_LENGTH} 个字符`);
  }

  const rawContext =
    candidate.context && typeof candidate.context === "object"
      ? (candidate.context as Record<string, unknown>)
      : {};
  const context: FeedbackContext = {};

  ////////////////////////////////////////////////////
  // Context 仅保留白名单中的短字符串；未知键、非字符串和超过 200 字符的值不进入存储
  ////////////////////////////////////////////////////
  for (const key of contextKeys) {
    const contextValue = rawContext[key];
    if (typeof contextValue === "string" && contextValue.length <= 200) {
      context[key] = contextValue;
    }
  }

  return { message, context };
}
