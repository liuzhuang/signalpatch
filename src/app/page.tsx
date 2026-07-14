import { FeedbackForm } from "@/components/feedback-form";
import { StatusForm } from "@/components/status-form";
import { ThemeToggle } from "@/components/theme-toggle";

////////////////////////////////////////////////////
// 首页只展示自动化阶段、Feedback 提交入口和 Repair Status 查询入口，不承载管理功能
////////////////////////////////////////////////////
export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="hero-topline">
          <div className="eyebrow">
            <span /> AI-native issue delivery reference
          </div>
          <ThemeToggle />
        </div>
        <h1>
          Signal<span>Patch</span>
        </h1>
        <p>
          从匿名 Feedback 到 GitHub Issue、Codex
          修复、验收和生产发布的可审计参考项目。
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
