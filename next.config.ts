import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: [
      '@supabase/supabase-js',
      '@supabase/ssr',
      'lucide-react',
      'date-fns',
      'recharts',
      'qrcode.react',
    ],
  },
}

export default nextConfig
