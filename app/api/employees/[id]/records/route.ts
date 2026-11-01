import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

function monthBounds(month: string) {
  const [y, mo] = month.split('-').map(Number)
  const from = `${month}-01`
  const lastDay = new Date(y, mo, 0).getDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

/** DELETE body: { months: string[] } e.g. ["2026-10","2026-09"] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const months: string[] = Array.isArray(body.months)
    ? [...new Set(body.months.map(String))].filter((m) => /^\d{4}-\d{2}$/.test(m))
    : []

  if (!months.length) {
    return NextResponse.json({ error: 'اختر شهراً واحداً على الأقل' }, { status: 400 })
  }

  const db = adminDb()

  const { data: emp } = await db
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن حذف سجلات المالك بهذا الشكل' }, { status: 400 })
  }

  const results = await Promise.all(
    months.map(async (month) => {
      const { from, to } = monthBounds(month)

      const dailyP = db
        .from('daily_attendance')
        .delete()
        .eq('employee_id', id)
        .eq('tenant_id', ctx.tenantId)
        .gte('work_date', from)
        .lte('work_date', to)
        .select('id')

      const recordsP = db
        .from('attendance_records')
        .delete()
        .eq('employee_id', id)
        .eq('tenant_id', ctx.tenantId)
        .gte('punched_at', `${from}T00:00:00`)
        .lte('punched_at', `${to}T23:59:59.999`)
        .select('id')

      const [dailyRes, recordsRes] = await Promise.all([dailyP, recordsP])

      let recCount = recordsRes.data?.length || 0
      if (recordsRes.error) {
        const fb = await db
          .from('attendance_records')
          .delete()
          .eq('employee_id', id)
          .eq('tenant_id', ctx.tenantId)
          .gte('work_date', from)
          .lte('work_date', to)
          .select('id')
        if (!fb.error) recCount = fb.data?.length || 0
      }

      if (dailyRes.error) throw new Error(dailyRes.error.message)
      return { daily: dailyRes.data?.length || 0, records: recCount }
    })
  )

  const deletedDaily = results.reduce((s, r) => s + r.daily, 0)
  const deletedRecords = results.reduce((s, r) => s + r.records, 0)

  return NextResponse.json({
    success: true,
    message: `تم حذف سجلات ${months.length} شهر لـ ${emp.full_name}`,
    deleted_daily: deletedDaily,
    deleted_records: deletedRecords,
    months,
  })
}
