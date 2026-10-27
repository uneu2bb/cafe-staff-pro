import { createClient } from '@/lib/supabase/server'
import { Users, UserCheck, UserX, Clock, CalendarDays, AlertTriangle, LogIn, Timer } from 'lucide-react'
import { formatTime, getStatusColor, getStatusLabel } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalEmployees },
    { data: todayAttendance },
    { data: recentRecords },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('daily_attendance').select('*, profiles(full_name, employee_number)').eq('work_date', today),
    supabase.from('attendance_records').select('*, profiles(full_name, employee_number)').order('recorded_at', { ascending: false }).limit(10),
  ])

  const present = todayAttendance?.filter((a: any) => a.status === 'present' || a.status === 'late').length || 0
  const late = todayAttendance?.filter((a: any) => a.status === 'late').length || 0
  const absent = todayAttendance?.filter((a: any) => a.status === 'absent').length || 0
  const incomplete = todayAttendance?.filter((a: any) => a.check_in_at && !a.check_out_at).length || 0
  const totalMins = todayAttendance?.reduce((s: number, a: any) => s + (a.net_worked_minutes || 0), 0) || 0

  const stats = [
    { label: 'إجمالي الموظفين', value: totalEmployees || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'حاضرون', value: present, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'متأخرون', value: late, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'غائبون', value: absent, icon: UserX, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'لم يسجلوا انصراف', value: incomplete, icon: LogIn, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'ساعات اليوم', value: Math.floor(totalMins / 60) + ':' + String(totalMins % 60).padStart(2, '0'), icon: Timer, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
        <p className="text-zinc-400 text-sm mt-1">نظرة عامة على الحضور اليوم</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{s.label}</span>
              <div className={'p-2 rounded-lg ' + s.bg}><s.icon size={16} className={s.color} /></div>
            </div>
            <p className={'text-2xl font-bold ' + s.color}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">آخر العمليات</h2>
        {!recentRecords?.length ? (
          <p className="text-zinc-500 text-sm text-center py-8">لا توجد عمليات بعد</p>
        ) : (
          <div className="space-y-3">
            {recentRecords.map((rec: any) => (
              <div key={rec.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <div className={'w-9 h-9 rounded-lg flex items-center justify-center ' + (rec.record_type === 'check_in' ? 'bg-emerald-500/15' : 'bg-red-500/15')}>
                  {rec.record_type === 'check_in' ? <LogIn size={16} className="text-emerald-400" /> : <Clock size={16} className="text-red-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-200 font-medium">{rec.profiles?.full_name}</p>
                  <p className="text-xs text-zinc-500">{rec.record_type === 'check_in' ? 'حضور' : 'انصراف'}</p>
                </div>
                <div className="text-xs text-zinc-500">{formatTime(rec.recorded_at, 'HH:mm:ss')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
