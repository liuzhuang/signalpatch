import Link from "next/link";

export default function About() {
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">Mock 数据</div>
        <h1>关于我们</h1>
        <p className="hero-copy">
          <strong>SignalPatch</strong> 是一个展示 Feedback 如何通过可审计的 AI
          自动化流程转化为生产修复的参考项目。
        </p>
      </header>
      <footer>
        <Link href="/">返回首页</Link>
        <a href="https://github.com/liuzhuang/signalpatch/issues">
          查看公开 Issue
        </a>
      </footer>
    </main>
  );
}
