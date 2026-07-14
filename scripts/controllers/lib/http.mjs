// 【做什么】控制器共用的 fetch JSON 封装与环境变量校验（超时、脱敏错误信息）
// 【说明】库模块，无 CLI 入口；被 intake-collect、record-run 等 import
export async function requestJson(url, options = {}) {
  ////////////////////////////////////////////////////
  // 所有控制器请求默认 30 秒超时；调用方显式提供 signal 时保留调用方的取消策略
  ////////////////////////////////////////////////////
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    ////////////////////////////////////////////////////
    // 错误只暴露状态码和服务端请求 ID，不把可能含敏感数据的响应正文写入日志
    ////////////////////////////////////////////////////
    const requestId =
      response.headers.get("x-github-request-id") ??
      response.headers.get("sb-request-id") ??
      "unavailable";
    throw new Error(
      `${options.method ?? "GET"} ${url} failed (${response.status}); request-id=${requestId}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

export function requireEnvironment(names) {
  ////////////////////////////////////////////////////
  // 在发起外部写操作前一次性验证必需环境变量，避免流程执行到一半才失败
  ////////////////////////////////////////////////////
  return Object.fromEntries(
    names.map((name) => {
      const value = process.env[name];
      if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
      }
      return [name, value];
    }),
  );
}
