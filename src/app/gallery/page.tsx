import Image from "next/image";
import Link from "next/link";

const galleryItems = [
  ["晨光", "#d84522"],
  ["纸页", "#d07a42"],
  ["花园", "#7a8f4b"],
  ["夜空", "#344b70"],
  ["海岸", "#3d8394"],
  ["山路", "#8c5a3d"],
  ["窗影", "#735b93"],
  ["橙子", "#cb6c25"],
  ["树林", "#4b755b"],
  ["云层", "#687b91"],
  ["湖面", "#2d7182"],
  ["岩石", "#71675e"],
  ["落日", "#bd4d35"],
  ["雨后", "#527a70"],
  ["书桌", "#9a7047"],
  ["街角", "#555e79"],
  ["苔藓", "#617b4c"],
  ["雾气", "#8995a0"],
  ["灯火", "#c26b31"],
  ["远方", "#416f85"],
] as const;

function mockImage(title: string, color: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="${color}"/><circle cx="620" cy="140" r="90" fill="white" fill-opacity=".16"/><path d="M0 480 220 280l150 130 130-180 300 250v120H0z" fill="white" fill-opacity=".2"/><text x="48" y="540" fill="white" font-family="Arial, sans-serif" font-size="48">${title}</text></svg>`,
  )}`;
}

export default function GalleryPage() {
  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <p className="eyebrow">
          <span /> Mock image collection
        </p>
        <h1 className="gallery-title">相册</h1>
        <p>20 张本地 Mock 图片。</p>
      </header>
      <section className="gallery-grid" aria-label="相册网格">
        {galleryItems.map(([title, color], index) => (
          <Image
            alt={`Mock 图片 ${index + 1}：${title}`}
            className="gallery-image"
            height={600}
            key={title}
            src={mockImage(title, color)}
            unoptimized
            width={800}
          />
        ))}
      </section>
      <footer>
        <Link href="/">返回首页</Link>
      </footer>
    </main>
  );
}
