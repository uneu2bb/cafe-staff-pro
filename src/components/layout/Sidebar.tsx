'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, Clock, CalendarDays, Wallet, FileBarChart, Settings, LogOut, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: 'الموظفون', icon: Users },
  { href: '/dashboard/attendance', label: 'الحضور', icon: Clock },
  { href: '/dashboard/leaves', label: 'الإجازات', icon: CalendarDays },
  { href: '/dashboard/payroll', label: 'الرواتب', icon: Wallet },
  { href: '/dashboard/reports', label: 'التقارير', icon: FileBarChart },
  { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-64 bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-40">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-500 flex items-center justify-center">
          <Coffee className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-white text-sm">Cafe Staff Pro</h2>
          <p className="text-[10px] text-zinc-500">إدارة الموظفين</p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              active ? 'bg-amber-700/20 text-amber-300 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            )}>
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 pb-2">
        <Link href="/kiosk" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60">
          <Clock size={18} />
          شاشة الحضور
        </Link>
      </div>
      <div className="p-3 border-t border-zinc-800">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 w-full">
          <LogOut size={18} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
