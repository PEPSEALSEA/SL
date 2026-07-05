import type { Options } from "qr-code-styling";
import type { QRConfig } from "./qrTypes";
import { DEFAULT_QR_CONFIG, RAINBOW_STOPS } from "./qrTypes";

type GradientOptions = {
  type: "linear";
  rotation: number;
  colorStops: { offset: number; color: string }[];
};

function buildGradient(config: QRConfig): GradientOptions {
  if (config.colorMode === "rainbow") {
    return {
      type: "linear",
      rotation: config.gradientRotation * (Math.PI / 180),
      colorStops: RAINBOW_STOPS,
    };
  }
  return {
    type: "linear",
    rotation: config.gradientRotation * (Math.PI / 180),
    colorStops: [
      { offset: 0, color: config.gradientStart },
      { offset: 1, color: config.gradientEnd },
    ],
  };
}

function buildColorOptions(config: QRConfig): { color?: string; gradient?: GradientOptions } {
  if (config.colorMode === "solid") {
    return { color: config.fgColor };
  }
  const gradient = buildGradient(config);
  return { gradient };
}

export function buildQROptions(
  content: string,
  config: QRConfig = DEFAULT_QR_CONFIG,
  logoUrl?: string
): Options {
  const colorOpts = buildColorOptions(config);

  const options: Options = {
    width: 512,
    height: 512,
    type: "canvas",
    data: content || "https://example.com",
    margin: config.margin,
    qrOptions: {
      errorCorrectionLevel: config.errorCorrection,
    },
    dotsOptions: {
      type: config.dotStyle,
      ...colorOpts,
    },
    cornersSquareOptions: {
      type: config.cornerSquareStyle,
      ...colorOpts,
    },
    cornersDotOptions: {
      type: config.cornerDotStyle,
      ...colorOpts,
    },
    backgroundOptions: {
      color: config.bgColor,
    },
  };

  if (logoUrl) {
    options.image = logoUrl;
    options.imageOptions = {
      crossOrigin: "anonymous",
      margin: config.logoMargin,
      imageSize: config.logoSize,
      hideBackgroundDots: config.hideBackgroundDots,
    };
  }

  return options;
}

export async function renderQRToDataUrl(
  content: string,
  config: QRConfig,
  logoUrl?: string
): Promise<string> {
  const QRCodeStyling = (await import("qr-code-styling")).default;
  const qr = new QRCodeStyling(buildQROptions(content, config, logoUrl));

  const blob = await qr.getRawData("png");
  if (!blob) throw new Error("Failed to render QR code");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob as Blob);
  });
}

export async function renderQRToBlob(
  content: string,
  config: QRConfig,
  logoUrl?: string
): Promise<Blob> {
  const QRCodeStyling = (await import("qr-code-styling")).default;
  const qr = new QRCodeStyling(buildQROptions(content, config, logoUrl));
  const blob = await qr.getRawData("png");
  if (!blob) throw new Error("Failed to render QR code");
  return blob as Blob;
}
