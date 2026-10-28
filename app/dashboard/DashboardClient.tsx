'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Profile = {
  full_name: string
  role: string
  employee_number: string
  email: string
}

type Stats = {
  employees: number
  presentToday: number
  absentToday: number
  lateToday: number
}

type DayRow = {
  id: string
  work_date: string
  check_in_at: string | null
  check_out_at: string | null
  worked_minutes: number | null
  net_worked_minutes: number | null
  status: string
  late_minutes: number | null
  profiles?: { full_name?: string; employee_number?: string } | null
}

type RecordRow = {
  id: string
  record_type: string
  recorded_at: string
  verification_method: string
  profiles?: { full_name?: string; employee_number?: string } | null
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('ar-SY', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function minsToHours(m: number | null) {
  if (m == null) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}:${String(min).padStart(2, '0')}`
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    on_leave: 'إجازة',
    incomplete: 'غير مكتمل',
  }
  return map[s] || s
}

function statusColor(s: string) {
  if (s === 'present') return { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: 'rgba(16,185,129,0.3)' }
  if (s === 'late') return { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: 'rgba(245,158,11,0.3)' }
  if (s === 'absent') return { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: 'rgba(239,68,68,0.3)' }
  return { bg: 'rgba(113,113,122,0.15)', color: '#a1a1aa', border: 'rgba(113,113,122,0.3)' }
}

const roleLabel: Record<string, string> = {
  owner: 'المالك',
  manager: 'مدير',
  accountant: 'محاسب',
  supervisor: 'مشرف',
  employee: 'موظف',
}

export default function DashboardClient({
  profile,
  isAdmin,
  stats,
  attendance,
  records,
}: {
  profile: Profile
  isAdmin: boolean
  stats: Stats
  attendance: DayRow[]
  records: RecordRow[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'days' | 'records' | 'absent'>('days')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const absentRows = attendance.filter((a) => a.status === 'absent')
  const presentRows = attendance.filter((a) => a.status !== 'absent')

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <header className="border-b border-zinc-800 sticky top-0 z-20" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}>
              <span>☕</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">Cafe Staff Pro</h1>
              <p className="text-xs text-zinc-500">{profile.full_name} · {roleLabel[profile.role] || profile.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/kiosk" className="btn-secondary text-xs px-3 py-2" style={{ textDecoration: 'none' }}>
              شاشة الحضور
            </Link>
            <button onClick={handleLogout} className="text-xs text-red-400 px-3 py-2 rounded-xl hover:bg-red-500/10">
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'الموظفون', value: stats.employees, color: '#60a5fa' },
            { label: 'حاضرون اليوم', value: stats.presentToday, color: '#6ee7b7' },
            { label: 'متأخرون اليوم', value: stats.lateToday, color: '#fcd34d' },
            { label: 'غائبون اليوم', value: stats.absentToday, color: '#fca5a5' },
          ].map((s) => (
            <div key={s.label} className="card">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          {(
            [
              { id: 'days' as const, label: 'سجل الحضور' },
              { id: 'records' as const, label: 'آخر العمليات' },
              { id: 'absent' as const, label: 'الغيابات' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(180,83,9,0.2)' : 'transparent',
                color: tab === t.id ? '#fbbf24' : '#a1a1aa',
                border: tab === t.id ? '1px solid rgba(180,83,9,0.4)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Attendance days */}
        {tab === 'days' && (
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="font-semibold text-white">سجل الحضور (آخر 30 يوم)</h2>
              <p className="text-xs text-zinc-500 mt-0.5">وقت الدخول والخروج وساعات العمل</p>
            </div>
            {!presentRows.length ? (
              <p className="text-center text-zinc-500 py-12 text-sm">لا توجد سجلات حضور بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                      {isAdmin && <th className="text-right px-4 py-3 font-medium">الموظف</th>}
                      <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                      <th className="text-right px-4 py-3 font-medium">دخول</th>
                      <th className="text-right px-4 py-3 font-medium">خروج</th>
                      <th className="text-right px-4 py-3 font-medium">الساعات</th>
                      <th className="text-right px-4 py-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentRows.map((row) => {
                      const sc = statusColor(row.status)
                      return (
                        <tr key={row.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                          {isAdmin && (
                            <td className="px-4 py-3 text-zinc-200">
                              {row.profiles?.full_name || '—'}
                              <span className="text-zinc-600 text-xs mr-1">#{row.profiles?.employee_number}</span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-zinc-300">{fmtDate(row.work_date)}</td>
                          <td className="px-4 py-3 text-emerald-400 font-mono" dir="ltr">{fmtTime(row.check_in_at)}</td>
                          <td className="px-4 py-3 text-red-400 font-mono" dir="ltr">{fmtTime(row.check_out_at)}</td>
                          <td className="px-4 py-3 text-zinc-300 font-mono" dir="ltr">{minsToHours(row.net_worked_minutes ?? row.worked_minutes)}</td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                            >
                              {statusLabel(row.status)}
                              {row.late_minutes ? ` (+${row.late_minutes}د)` : ''}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Last operations */}
        {tab === 'records' && (
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="font-semibold text-white">آخر عمليات الحضور/الانصراف</h2>
            </div>
            {!records.length ? (
              <p className="text-center text-zinc-500 py-12 text-sm">لا توجد عمليات بعد</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{
                        background: r.record_type === 'check_in' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: r.record_type === 'check_in' ? '#6ee7b7' : '#fca5a5',
                      }}
                    >
                      {r.record_type === 'check_in' ? '↓' : '↑'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">
                        {r.profiles?.full_name || 'موظف'}
                        <span className="text-zinc-500"> · {r.record_type === 'check_in' ? 'حضور' : 'انصراف'}</span>
                      </p>
                      <p className="text-xs text-zinc-500">{r.verification_method === 'pin' ? 'رقم سري' : r.verification_method}</p>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono" dir="ltr">
                      {new Date(r.recorded_at).toLocaleString('ar-SY', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Absences */}
        {tab === 'absent' && (
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="font-semibold text-white">سجل الغيابات</h2>
              <p className="text-xs text-zinc-500 mt-0.5">الأيام المسجّلة كغياب خلال آخر 30 يوم</p>
            </div>
            {!absentRows.length ? (
              <p className="text-center text-zinc-500 py-12 text-sm">لا توجد غيابات مسجّلة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                      {isAdmin && <th className="text-right px-4 py-3 font-medium">الموظف</th>}
                      <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                      <th className="text-right px-4 py-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentRows.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800/60">
                        {isAdmin && (
                          <td className="px-4 py-3 text-zinc-200">{row.profiles?.full_name || '—'}</td>
                        )}
                        <td className="px-4 py-3 text-zinc-300">{fmtDate(row.work_date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                            غائب
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
