import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LMR — إدارة الموظفين',
    short_name: 'LMR',
    description: 'نظام إدارة الموظفين والحضور والانصراف والرواتب',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080b0e',
    theme_color: '#080b0e',
    lang: 'ar',
    dir: 'rtl',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
