export type QRColorMode = "solid" | "gradient" | "rainbow";
export type QRDotStyle = "square" | "dots" | "rounded" | "extra-rounded" | "classy" | "classy-rounded";
export type QRCornerSquareStyle = "square" | "dot" | "extra-rounded";
export type QRCornerDotStyle = "square" | "dot";
export type QRErrorCorrection = "L" | "M" | "Q" | "H";

export interface QRConfig {
  colorMode: QRColorMode;
  fgColor: string;
  bgColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientRotation: number;
  dotStyle: QRDotStyle;
  cornerSquareStyle: QRCornerSquareStyle;
  cornerDotStyle: QRCornerDotStyle;
  errorCorrection: QRErrorCorrection;
  margin: number;
  logoSize: number;
  logoMargin: number;
  logoRound: boolean;
  hideBackgroundDots: boolean;
  logoBase64?: string;
}

export interface SavedQR {
  id: string;
  name: string;
  content: string;
  config: QRConfig;
  logoDriveId?: string;
  imageDriveId?: string;
  created: string;
}

export const RAINBOW_STOPS = [
  { offset: 0, color: "#ff0000" },
  { offset: 0.17, color: "#ff7f00" },
  { offset: 0.33, color: "#ffff00" },
  { offset: 0.5, color: "#00ff00" },
  { offset: 0.67, color: "#0000ff" },
  { offset: 0.83, color: "#4b0082" },
  { offset: 1, color: "#9400d3" },
];

export const DEFAULT_QR_CONFIG: QRConfig = {
  colorMode: "solid",
  fgColor: "#000000",
  bgColor: "#ffffff",
  gradientStart: "#5e6ad2",
  gradientEnd: "#828fff",
  gradientRotation: 0,
  dotStyle: "square",
  cornerSquareStyle: "square",
  cornerDotStyle: "square",
  errorCorrection: "M",
  margin: 10,
  logoSize: 0.4,
  logoMargin: 4,
  logoRound: true,
  hideBackgroundDots: true,
};

export function driveImageUrl(driveId: string): string {
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
}

export function getLogoUrl(config: QRConfig, logoDriveId?: string): string | undefined {
  if (config.logoBase64) return config.logoBase64;
  if (logoDriveId) return driveImageUrl(logoDriveId);
  return undefined;
}

export async function compressLogoDataUrl(dataUrl: string, maxSize = 200): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png", 0.85);
}
