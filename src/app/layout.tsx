import type { Metadata } from "next";
import "./globals.css";

////////////////////////////////////////////////////
// 根布局统一声明站点元数据和中文文档语言，所有页面共用全局样式与纵向页面结构
////////////////////////////////////////////////////
export const metadata: Metadata = {
  title: "SignalPatch — Feedback to Production",
  description: "AI-native GitHub Issue 到生产发布的参考实现。",
};

////////////////////////////////////////////////////
// 这里只提供应用外壳，具体 Feedback 和 Repair Status 功能由页面组件负责
////////////////////////////////////////////////////
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
