/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse reads test fixtures from disk at import time which breaks
  // Turbopack's static analysis. Marking it as external skips bundling it.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
