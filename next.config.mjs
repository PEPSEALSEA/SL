/** @type {import('next').NextConfig} */
const repo = process.env.GITHUB_REPOSITORY || '';
const repoName = repo.includes('/') ? repo.split('/')[1] : 'SL';
const basePath = '/' + repoName;

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    basePath: basePath,
    assetPrefix: basePath,
    trailingSlash: true,
    env: {
        NEXT_PUBLIC_BASE_PATH: basePath,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://sl-worker.sealseapep.workers.dev",
    },
};

export default nextConfig;
