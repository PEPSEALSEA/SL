/** @type {import('next').NextConfig} */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'SL';
const basePath = `/${repoName}`;

const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    basePath,
    assetPrefix: basePath,
    trailingSlash: true,
    env: {
        NEXT_PUBLIC_BASE_PATH: basePath,
    },
};

export default nextConfig;
