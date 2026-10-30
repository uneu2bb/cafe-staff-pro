import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cafe Staff Pro',
  description: 'نظام إدارة الموظفين والحضور والانصراف',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#080b0e" />
      </head>
      <body>{children}</body>
    </html>
  )
}
