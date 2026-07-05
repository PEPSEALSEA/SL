"use client";

import { useEffect, useRef } from "react";
import { buildQROptions } from "@/utils/qrRender";
import { getLogoUrl, QRConfig } from "@/utils/qrTypes";

export default function QRMiniPreview({
  content,
  config,
  logoDriveId,
  size = 100,
}: {
  content: string;
  config: QRConfig;
  logoDriveId?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !content.trim()) return;

    let cancelled = false;

    (async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      if (cancelled || !ref.current) return;

      const logoUrl = getLogoUrl(config, logoDriveId);
      const qr = new QRCodeStyling({
        ...buildQROptions(content, config, logoUrl),
        width: size,
        height: size,
      });
      ref.current.innerHTML = "";
      qr.append(ref.current);
    })();

    return () => { cancelled = true; };
  }, [content, config, logoDriveId, size]);

  return <div ref={ref} className="qr-mini-preview" style={{ width: size, height: size }} />;
}
