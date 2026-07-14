export const HOMEPAGE_COPY = [
  "从匿名 Feedback 到 GitHub Issue、Codex 修复、验收和生产发布的可审计参考项目。",
  "让每一次 Feedback 都有一条可追踪、可验证的修复路径。",
  "把问题证据交给自动化，把发布决定留在验证之后。",
] as const;

export function pickRandomCopy(random = Math.random()) {
  const index = Math.min(
    Math.floor(random * HOMEPAGE_COPY.length),
    HOMEPAGE_COPY.length - 1,
  );
  return HOMEPAGE_COPY[index];
}

export function RandomCopy() {
  return <p className="hero-copy">{pickRandomCopy()}</p>;
}
