import type { NextConfig } from "next";

const nextConfig = {
  output: 'export',
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@tiptap/react', '@tiptap/pm'],
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig