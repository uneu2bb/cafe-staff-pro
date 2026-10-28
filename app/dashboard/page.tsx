export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, employee_number, status')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  // آخر 30 يوم
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)
  const fromStr = fromDate.toISOString().slice(0, 10)

  let attendanceQuery = supabase
    .from('daily_attendance')
    .select('id, work_date, check_in_at, check_out_at, worked_minutes, net_worked_minutes, status, late_minutes, employee_id, profiles(full_name, employee_number)')
    .gte('work_date', fromStr)
    .order('work_date', { ascending: false })
    .limit(100)

  if (!isAdmin) {
    attendanceQuery = attendanceQuery.eq('employee_id', user.id)
  }

  const { data: attendance } = await attendanceQuery

  let recordsQuery = supabase
    .from('attendance_records')
    .select('id, record_type, recorded_at, verification_method, employee_id, profiles(full_name, employee_number)')
    .order('recorded_at', { ascending: false })
    .limit(50)

  if (!isAdmin) {
    recordsQuery = recordsQuery.eq('employee_id', user.id)
  }

  const { data: records } = await recordsQuery

  const { count: employeesCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const today = new Date().toISOString().slice(0, 10)
  const todayRows = (attendance || []).filter((a: { work_date: string }) => a.work_date === today)
  const presentToday = todayRows.filter((a: { status: string }) => a.status === 'present' || a.status === 'late').length
  const absentToday = todayRows.filter((a: { status: string }) => a.status === 'absent').length
  const lateToday = todayRows.filter((a: { status: string }) => a.status === 'late').length

  return (
    <DashboardClient
      profile={{
        full_name: profile?.full_name || user.email || '',
        role: profile?.role || 'employee',
        employee_number: profile?.employee_number || '',
        email: user.email || '',
      }}
      isAdmin={!!isAdmin}
      stats={{
        employees: employeesCount || 0,
        presentToday,
        absentToday,
        lateToday,
      }}
      attendance={(attendance || []) as any[]}
      records={(records || []) as any[]}
    />
  )
}
