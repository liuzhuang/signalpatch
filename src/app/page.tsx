import { FeedbackForm } from "@/components/feedback-form";
import { StatusForm } from "@/components/status-form";

////////////////////////////////////////////////////
// 首页只展示自动化阶段、Feedback 提交入口和 Repair Status 查询入口，不承载管理功能
////////////////////////////////////////////////////
export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">
          <span /> AI-native issue delivery reference
        </div>
        <h1>
          Signal<span>Patch</span>
        </h1>
        <p>
          从匿名 Feedback 到 GitHub Issue、Codex
          修复、验收和生产发布的可审计参考项目。
        </p>
        <p>
          Codex 对话在用户确认后只写入受控队列，由独立 Controller 创建
          Issue；应用内 Feedback 仍可匿名提交。
        </p>
        <div className="flow" aria-label="自动化阶段">
          <span>Feedback</span>
          <i>→</i>
          <span>Issue Contract</span>
          <i>→</i>
          <span>Pull Request</span>
          <i>→</i>
          <span>Production</span>
        </div>
        <div className="flow" aria-label="Codex 对话 Issue 上报流程">
          <span>Codex 对话</span>
          <i>→</i>
          <span>受控队列</span>
          <i>→</i>
          <span>独立 Controller</span>
          <i>→</i>
          <span>GitHub Issue</span>
        </div>
      </header>
      <section className="workspace">
        <FeedbackForm />
        <StatusForm />
      </section>
      <footer>
        <span>不保存完整会话</span>
        <span>Tracking ID 不代表用户身份</span>
        <a href="https://github.com/liuzhuang/signalpatch">查看公开仓库</a>
      </footer>
    </main>
  );
}
