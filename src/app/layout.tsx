import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cafe Staff Pro',
  description: 'نظام إدارة الموظفين والحضور والانصراف',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
