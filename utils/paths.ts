export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(path: string): string {
  if (!basePath) return path;
  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

const redirectBase = process.env.NEXT_PUBLIC_API_URL || 'https://sl-worker.sealseapep.workers.dev';

export type ShortUrlPair = {
  fast: string;
  legacy: string;
};

export function buildFastShortUrl(shortCode: string): string {
  return `${redirectBase}/sl/${shortCode}`;
}

export function buildLegacyShortUrl(origin: string, shortCode: string): string {
  return `${origin}${basePath}/${shortCode}`;
}

export function getShortUrls(origin: string, shortCode: string): ShortUrlPair {
  return {
    fast: buildFastShortUrl(shortCode),
    legacy: buildLegacyShortUrl(origin, shortCode),
  };
}

export function buildShortUrl(shortCode: string): string {
  return buildFastShortUrl(shortCode);
}
