/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'jszip', 'xlsx'],
  },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
