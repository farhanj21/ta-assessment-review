/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server Actions are stable in Next 15; we only raise the body limit ceiling
    // slightly because reviewer comments can be long-form free text.
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
