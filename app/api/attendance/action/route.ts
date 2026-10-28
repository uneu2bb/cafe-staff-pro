import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant', 'supervisor'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { employee_id, action } = body as {
    employee_id: string
    action: 'check_in' | 'check_out' | 'save_session'
    check_in_at?: string
    check_out_at?: string
  }

  if (!employee_id || !action) {
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  }

  const db = adminDb()
  const { data: employee } = await db
    .from('profiles')
    .select('id, full_name, status, branch_id, tenant_id')
    .eq('id', employee_id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!employee || employee.status !== 'active') {
    return NextResponse.json({ error: 'الموظف غير متاح' }, { status: 404 })
  }

  if (action === 'save_session') {
    const checkInAt = body.check_in_at ? new Date(body.check_in_at) : null
    const checkOutAt = body.check_out_at ? new Date(body.check_out_at) : null
    if (!checkInAt || isNaN(checkInAt.getTime())) {
      return NextResponse.json({ error: 'وقت الحضور غير صالح' }, { status: 400 })
    }
    if (!checkOutAt || isNaN(checkOutAt.getTime())) {
      return NextResponse.json({ error: 'وقت الانصراف غير صالح' }, { status: 400 })
    }
    if (checkOutAt <= checkInAt) {
      return NextResponse.json({ error: 'الانصراف يجب أن يكون بعد الحضور' }, { status: 400 })
    }

    const workDate = checkInAt.toISOString().slice(0, 10)
    const workedMinutes = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000)

    await db.from('attendance_records').insert([
      {
        employee_id,
        tenant_id: ctx.tenantId,
        record_type: 'check_in',
        recorded_at: checkInAt.toISOString(),
        branch_id: employee.branch_id,
        method: 'manual',
      },
      {
        employee_id,
        tenant_id: ctx.tenantId,
        record_type: 'check_out',
        recorded_at: checkOutAt.toISOString(),
        branch_id: employee.branch_id,
        method: 'manual',
      },
    ])

    await db.from('daily_attendance').upsert(
      {
        employee_id,
        tenant_id: ctx.tenantId,
        work_date: workDate,
        branch_id: employee.branch_id,
        status: 'present',
        check_in_at: checkInAt.toISOString(),
        check_out_at: checkOutAt.toISOString(),
        worked_minutes: workedMinutes,
        net_worked_minutes: workedMinutes,
      },
      { onConflict: 'employee_id,work_date' }
    )

    return NextResponse.json({
      success: true,
      message: 'تم حفظ الدوام',
      check_in_at: checkInAt.toISOString(),
      check_out_at: checkOutAt.toISOString(),
      worked_minutes: workedMinutes,
    })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
