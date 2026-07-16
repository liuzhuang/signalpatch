"use client";

import Image from "next/image";
import { useRef } from "react";

export function ContactDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div>
      <button
        className="contact-trigger"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        联系我
      </button>
      <dialog
        aria-labelledby="contact-dialog-title"
        className="contact-dialog"
        ref={dialogRef}
      >
        <div className="contact-dialog-content">
          <h2 id="contact-dialog-title">微信二维码</h2>
          <p>临时 Mock 图片，请勿用于真实扫码。</p>
          <Image
            alt="Mock 微信二维码"
            className="contact-qr"
            height={240}
            src="/contact-wechat-qr.svg"
            width={240}
          />
          <form method="dialog">
            <button type="submit">关闭</button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
