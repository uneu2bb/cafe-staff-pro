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
    <html lang="ar" dir="rtl" className="dark">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  )
}
