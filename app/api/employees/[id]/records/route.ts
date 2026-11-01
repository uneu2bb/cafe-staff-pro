import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

/** DELETE body: { months: string[] } e.g. ["2026-10","2026-09"] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const months: string[] = Array.isArray(body.months) ? body.months.map(String) : []

  if (!months.length) {
    return NextResponse.json({ error: 'اختر شهراً واحداً على الأقل' }, { status: 400 })
  }

  for (const m of months) {
    if (!/^\d{4}-\d{2}$/.test(m)) {
      return NextResponse.json({ error: `شهر غير صالح: ${m}` }, { status: 400 })
    }
  }

  const db = adminDb()

  const { data: emp } = await db
    .from('profiles')
    .select('id, full_name, role, tenant_id')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن حذف سجلات المالك بهذا الشكل' }, { status: 400 })
  }

  let deletedDaily = 0
  let deletedRecords = 0

  for (const month of months) {
    const [y, mo] = month.split('-').map(Number)
    const from = `${month}-01`
    const lastDay = new Date(y, mo, 0).getDate()
    const to = `${month}-${String(lastDay).padStart(2, '0')}`

    const { data: dRows, error: dErr } = await db
      .from('daily_attendance')
      .delete()
      .eq('employee_id', id)
      .eq('tenant_id', ctx.tenantId)
      .gte('work_date', from)
      .lte('work_date', to)
      .select('id')

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
    deletedDaily += dRows?.length || 0

    const { data: aRows, error: aErr } = await db
      .from('attendance_records')
      .delete()
      .eq('employee_id', id)
      .eq('tenant_id', ctx.tenantId)
      .gte('punched_at', `${from}T00:00:00`)
      .lte('punched_at', `${to}T23:59:59.999`)
      .select('id')

    if (!aErr) {
      deletedRecords += aRows?.length || 0
    } else {
      const { data: a2, error: a2Err } = await db
        .from('attendance_records')
        .delete()
        .eq('employee_id', id)
        .eq('tenant_id', ctx.tenantId)
        .gte('work_date', from)
        .lte('work_date', to)
        .select('id')
      if (!a2Err) deletedRecords += a2?.length || 0
    }
  }

  return NextResponse.json({
    success: true,
    message: `تم حذف سجلات ${months.length} شهر للموظف ${emp.full_name}`,
    deleted_daily: deletedDaily,
    deleted_records: deletedRecords,
    months,
  })
}
