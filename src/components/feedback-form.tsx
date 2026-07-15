"use client";

import { useState, type FormEvent } from "react";

////////////////////////////////////////////////////
// 表单只读取 API 响应中的匿名 Tracking ID 和初始 Repair Status
////////////////////////////////////////////////////
interface SubmitResult {
  trackingId: string;
  repairStatus: string;
}

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  ////////////////////////////////////////////////////
  // 提交前清除上次结果，并附加当前功能、页面路由和发生时间作为脱敏 Feedback Context
  ////////////////////////////////////////////////////
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            feature: "feedback-form",
            route: window.location.pathname,
            occurredAt: new Date().toISOString(),
          },
        }),
      });
      const body = (await response.json()) as SubmitResult & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Feedback 提交失败");
      }

      ////////////////////////////////////////////////////
      // 成功后保留 Tracking ID 供后续查询，同时清空已提交的 Feedback 正文
      ////////////////////////////////////////////////////
      setResult(body);
      setMessage("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Feedback 提交失败",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <span className="step">01</span>
        <div>
          <h2>提交 Feedback</h2>
          <p>无需登录，提交后会获得 Tracking ID，可随时查询处理状态。</p>
        </div>
      </div>
      <label htmlFor="feedback">问题或建议</label>
      <textarea
        id="feedback"
        maxLength={2000}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="例如：复制追踪编号后总是查不到"
        required
        rows={6}
        value={message}
      />
      <output
        aria-label="Feedback 字数"
        className="character-count"
        htmlFor="feedback"
      >
        {message.length} / 2000
      </output>
      <button disabled={submitting} type="submit">
        {submitting ? "正在提交" : "获取 Tracking ID"}
      </button>
      {error ? <p className="message error">{error}</p> : null}
      {result ? (
        <div className="result" aria-live="polite">
          <span>Tracking ID</span>
          <code>{result.trackingId}</code>
          <small>当前状态：{result.repairStatus}</small>
        </div>
      ) : null}
    </form>
  );
}
