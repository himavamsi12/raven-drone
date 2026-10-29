/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production checks separate from the running development preview.
  // Vercel expects the default .next output.
  distDir: process.env.NODE_ENV === "production" && !process.env.VERCEL ? ".next-production" : ".next",
  reactStrictMode: false,
  images: { unoptimized: true },
  transpilePackages: ["three"],
};

export default nextConfig;
