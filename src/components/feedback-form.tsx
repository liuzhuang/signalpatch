"use client";

import { useState, type FormEvent } from "react";

interface SubmitResult {
  trackingId: string;
  repairStatus: string;
}

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          <p>简短描述实际体验，系统会附加脱敏运行信息。</p>
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
