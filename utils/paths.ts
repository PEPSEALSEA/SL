export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(path: string): string {
  if (!basePath) return path;
  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildShortUrl(origin: string, shortCode: string): string {
  return `${origin}${basePath}/${shortCode}`;
}
