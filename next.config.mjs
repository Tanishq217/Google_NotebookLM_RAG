/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse uses some node.js built-ins that need to run server-side only
  // this tells Next.js to not bundle those for the edge runtime
  serverExternalPackages: ["pdf-parse"],

  // increase the body size limit for file uploads (default is 4MB)
  experimental: {},
};

export default nextConfig;
