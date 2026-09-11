/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  output: process.env.BUILD_TARGET === "capacitor" ? "export" : undefined,
};

module.exports = nextConfig;
