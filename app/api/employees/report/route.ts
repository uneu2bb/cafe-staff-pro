import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const employeeId = req.nextUrl.searchParams.get('employee_id')
  const month = req.nextUrl.searchParams.get('month')
  if (!employeeId || !month) {
    return NextResponse.json({ error: 'employee_id و month مطلوبان' }, { status: 400 })
  }

  const db = adminDb()
  const { data: emp } = await db
    .from('profiles')
    .select('id, full_name, employee_number, salary_amount, work_hours_per_day, tenant_id')
    .eq('id', employeeId)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })

  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`

  const { data: days } = await db
    .from('daily_attendance')
    .select('work_date, status, check_in_at, check_out_at, worked_minutes, net_worked_minutes')
    .eq('employee_id', employeeId)
    .eq('tenant_id', ctx.tenantId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })

  const hoursPerDay = Number(emp.work_hours_per_day) || 8
  const monthlySalary = Number(emp.salary_amount) || 0
  const expectedWorkDays = 30
  const dayRate = monthlySalary / expectedWorkDays
  const hourlyRate = hoursPerDay > 0 ? dayRate / hoursPerDay : 0

  let presentDays = 0,
    absentDays = 0,
    incompleteDays = 0,
    totalMinutes = 0
  for (const r of days || []) {
    const mins = r.net_worked_minutes ?? r.worked_minutes ?? 0
    if (r.status === 'absent') absentDays++
    else if (r.check_in_at && r.check_out_at) {
      presentDays++
      totalMinutes += mins
    } else if (r.check_in_at && !r.check_out_at) {
      incompleteDays++
      totalMinutes += mins
    } else if (r.status === 'present' || r.status === 'late') {
      presentDays++
      totalMinutes += mins
    }
  }

  const totalHours = totalMinutes / 60
  const earnedByHours = totalHours * hourlyRate
  const fixedWithDeductions = Math.max(0, monthlySalary - absentDays * dayRate)

  let withdrawnUsd = 0
  const withdrawalList: { amount: number; currency: string; note: string | null; withdrawn_at: string }[] = []
  const rates = { SYP: 15000, TRY: 34 }
  const { data: settings } = await db
    .from('system_settings')
    .select('key, value')
    .eq('tenant_id', ctx.tenantId)
  for (const s of settings || []) {
    if (s.key === 'rate_syp_per_usd') rates.SYP = Number(s.value) || 15000
    if (s.key === 'rate_try_per_usd') rates.TRY = Number(s.value) || 34
  }

  const { data: wd } = await db
    .from('employee_withdrawals')
    .select('amount, currency, note, withdrawn_at')
    .eq('employee_id', employeeId)
    .eq('tenant_id', ctx.tenantId)
    .gte('withdrawn_at', from + 'T00:00:00')
    .lte('withdrawn_at', to + 'T23:59:59')
    .order('withdrawn_at', { ascending: false })

  for (const w of wd || []) {
    const amt = Number(w.amount) || 0
    withdrawalList.push(w as any)
    if (w.currency === 'USD') withdrawnUsd += amt
    else if (w.currency === 'SYP') withdrawnUsd += amt / rates.SYP
    else if (w.currency === 'TRY') withdrawnUsd += amt / rates.TRY
  }

  const net = Math.max(0, earnedByHours - withdrawnUsd)
  const netFixed = Math.max(0, fixedWithDeductions - withdrawnUsd)

  return NextResponse.json({
    employee: emp,
    month,
    days: days || [],
    stats: {
      presentDays,
      absentDays,
      incompleteDays,
      totalMinutes,
      totalHours,
      monthlySalary,
      expectedWorkDays,
      dayRate,
      hourlyRate,
      hoursPerDay,
      earnedByHours,
      fixedWithDeductions,
      withdrawnUsd,
      net,
      netFixed,
      rates,
    },
    withdrawals: withdrawalList,
  })
}
