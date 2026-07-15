"use client";

import { useState, type FormEvent } from "react";

////////////////////////////////////////////////////
// 查询结果对应公开 Repair Status，不包含 Feedback、Problem 或内部数据库 ID
////////////////////////////////////////////////////
interface StatusResult {
  trackingId: string;
  repairStatus: string;
  updatedAt: string;
}

export function StatusForm() {
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  ////////////////////////////////////////////////////
  // Tracking ID 作为路径参数编码，首尾空白由服务端统一规范化后再查询
  ////////////////////////////////////////////////////
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/status/${encodeURIComponent(trackingId)}`,
      );
      const body = (await response.json()) as StatusResult & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Repair Status 查询失败");
      }

      ////////////////////////////////////////////////////
      // 每次只展示本次查询结果；新查询开始时已清除旧结果和旧错误
      ////////////////////////////////////////////////////
      setResult(body);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Repair Status 查询失败",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <span className="step">02</span>
        <div>
          <h2>查询 Repair Status</h2>
          <p>Tracking ID 只用于匿名查询，不代表用户身份。</p>
        </div>
      </div>
      <label htmlFor="tracking-id">Tracking ID</label>
      <input
        id="tracking-id"
        onChange={(event) => setTrackingId(event.target.value)}
        placeholder="粘贴提交后获得的 Tracking ID"
        required
        value={trackingId}
      />
      <button disabled={loading} type="submit">
        {loading ? "正在查询" : "查看处理状态"}
      </button>
      {error ? <p className="message error">{error}</p> : null}
      {result ? (
        <div className="result" aria-live="polite">
          <span>Repair Status</span>
          <strong>{result.repairStatus}</strong>
          <small>
            更新时间：{new Date(result.updatedAt).toLocaleString("zh-CN")}
          </small>
        </div>
      ) : null}
    </form>
  );
}
