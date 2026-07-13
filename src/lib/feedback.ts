const MAX_MESSAGE_LENGTH = 2_000;

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
  for (const key of contextKeys) {
    const contextValue = rawContext[key];
    if (typeof contextValue === "string" && contextValue.length <= 200) {
      context[key] = contextValue;
    }
  }

  return { message, context };
}
