import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

function monthBounds(month: string) {
  const [y, mo] = month.split('-').map(Number)
  const from = month + '-01'
  const lastDay = new Date(y, mo, 0).getDate()
  const to = month + '-' + String(lastDay).padStart(2, '0')
  return { from, to }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  let body: any = {}
  try { body = await req.json() } catch {}
  const raw = Array.isArray(body.months) ? body.months : []
  const months = Array.from(new Set(raw.map(String))).filter((m) => /^\d{4}-\d{2}$/.test(m))

  if (!months.length) {
    return NextResponse.json({ error: 'اختر شهراً واحداً على الأقل' }, { status: 400 })
  }

  const db = adminDb()

  const { data: emp, error: empErr } = await db
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (empErr || !emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن حذف سجلات المالك بهذا الشكل' }, { status: 400 })
  }

  try {
    const results = await Promise.all(
      months.map(async (month) => {
        const { from, to } = monthBounds(month)
        const dailyRes = await db
          .from('daily_attendance')
          .delete()
          .eq('employee_id', id)
          .eq('tenant_id', ctx.tenantId)
          .gte('work_date', from)
          .lte('work_date', to)
          .select('id')

        let recCount = 0
        const r1 = await db
          .from('attendance_records')
          .delete()
          .eq('employee_id', id)
          .eq('tenant_id', ctx.tenantId)
          .gte('punched_at', from + 'T00:00:00')
          .lte('punched_at', to + 'T23:59:59.999')
          .select('id')

        if (!r1.error) {
          recCount = r1.data?.length || 0
        } else {
          const r2 = await db
            .from('attendance_records')
            .delete()
            .eq('employee_id', id)
            .eq('tenant_id', ctx.tenantId)
            .gte('work_date', from)
            .lte('work_date', to)
            .select('id')
          if (!r2.error) recCount = r2.data?.length || 0
        }

        return {
          daily: dailyRes.error ? 0 : (dailyRes.data?.length || 0),
          records: recCount,
          err: dailyRes.error?.message || null,
        }
      })
    )

    const deletedDaily = results.reduce((s, r) => s + r.daily, 0)
    const deletedRecords = results.reduce((s, r) => s + r.records, 0)

    return NextResponse.json({
      success: true,
      message: 'تم حذف سجلات ' + months.length + ' شهر لـ ' + emp.full_name,
      deleted_daily: deletedDaily,
      deleted_records: deletedRecords,
      months,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل الحذف' }, { status: 500 })
  }
}
