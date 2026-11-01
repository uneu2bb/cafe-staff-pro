import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({ months: [] as string[] }))
  const months = (Array.isArray(body.months) ? body.months : [])
    .map(String)
    .filter((m: string) => /^\d{4}-\d{2}$/.test(m))

  if (!months.length) {
    return NextResponse.json({ error: 'اختر شهراً واحداً على الأقل' }, { status: 400 })
  }

  const db = adminDb()
  const { data: emp } = await db
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن حذف سجلات المالك بهذا الشكل' }, { status: 400 })
  }

  let deletedDaily = 0
  let deletedRecords = 0

  await Promise.all(
    months.map(async (month: string) => {
      const parts = month.split('-')
      const y = Number(parts[0])
      const mo = Number(parts[1])
      const from = month + '-01'
      const lastDay = new Date(y, mo, 0).getDate()
      const to = month + '-' + String(lastDay).padStart(2, '0')

      const dRes = await db
        .from('daily_attendance')
        .delete()
        .eq('employee_id', id)
        .eq('tenant_id', ctx.tenantId)
        .gte('work_date', from)
        .lte('work_date', to)
        .select('id')
      if (!dRes.error) deletedDaily += dRes.data?.length || 0

      const rRes = await db
        .from('attendance_records')
        .delete()
        .eq('employee_id', id)
        .eq('tenant_id', ctx.tenantId)
        .gte('work_date', from)
        .lte('work_date', to)
        .select('id')
      if (!rRes.error) deletedRecords += rRes.data?.length || 0
    })
  )

  return NextResponse.json({
    success: true,
    message: 'تم حذف سجلات ' + months.length + ' شهر لـ ' + emp.full_name,
    deleted_daily: deletedDaily,
    deleted_records: deletedRecords,
    months,
  })
}
