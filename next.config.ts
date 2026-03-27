import type { NextConfig } from "next";

const nextConfig = {
  output: 'export',
  experimental: {
    optimizePackageImports: ['lucide-react', '@tiptap/react', '@tiptap/pm'],
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig