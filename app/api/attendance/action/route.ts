import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant', 'supervisor'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { employee_id, action } = body as {
    employee_id: string
    action: 'check_in' | 'check_out' | 'save_session' | 'qr_toggle'
    check_in_at?: string
    check_out_at?: string
    method?: string
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

  const method = body.method === 'qr' ? 'qr' : 'manual'
  const now = new Date()
  const workDate = now.toISOString().slice(0, 10)

  if (action === 'qr_toggle' || action === 'check_in' || action === 'check_out') {
    const { data: day } = await db
      .from('daily_attendance')
      .select('id, check_in_at, check_out_at, worked_minutes')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .maybeSingle()

    const hasIn = !!(day?.check_in_at)
    const hasOut = !!(day?.check_out_at)

    let resolved: 'check_in' | 'check_out' = action === 'check_out' ? 'check_out' : 'check_in'
    if (action === 'qr_toggle') {
      if (!hasIn) resolved = 'check_in'
      else if (!hasOut) resolved = 'check_out'
      else {
        return NextResponse.json({
          success: false,
          error: `تم تسجيل حضور وانصراف «${employee.full_name}» لهذا اليوم`,
          employee_name: employee.full_name,
          already_done: true,
        }, { status: 400 })
      }
    }

    if (resolved === 'check_in') {
      if (hasIn) {
        return NextResponse.json({
          success: false,
          error: `«${employee.full_name}» مسجّل حضور مسبقاً`,
          employee_name: employee.full_name,
        }, { status: 400 })
      }
      const iso = now.toISOString()
      await db.from('attendance_records').insert({
        employee_id,
        tenant_id: ctx.tenantId,
        record_type: 'check_in',
        recorded_at: iso,
        branch_id: employee.branch_id,
        method,
      })
      await db.from('daily_attendance').upsert(
        {
          employee_id,
          tenant_id: ctx.tenantId,
          work_date: workDate,
          branch_id: employee.branch_id,
          status: 'present',
          check_in_at: iso,
          check_out_at: null,
          worked_minutes: null,
          net_worked_minutes: null,
        },
        { onConflict: 'employee_id,work_date' }
      )
      return NextResponse.json({
        success: true,
        action: 'check_in',
        message: `تم تسجيل حضور «${employee.full_name}»`,
        employee_name: employee.full_name,
        check_in_at: iso,
      })
    }

    // check_out
    if (!hasIn) {
      return NextResponse.json({
        success: false,
        error: `لا يوجد حضور مسجّل لـ «${employee.full_name}» اليوم`,
        employee_name: employee.full_name,
      }, { status: 400 })
    }
    if (hasOut) {
      return NextResponse.json({
        success: false,
        error: `تم تسجيل انصراف «${employee.full_name}» مسبقاً`,
        employee_name: employee.full_name,
      }, { status: 400 })
    }

    const iso = now.toISOString()
    const inAt = new Date(day!.check_in_at as string)
    const workedMinutes = Math.max(0, Math.round((now.getTime() - inAt.getTime()) / 60000))

    await db.from('attendance_records').insert({
      employee_id,
      tenant_id: ctx.tenantId,
      record_type: 'check_out',
      recorded_at: iso,
      branch_id: employee.branch_id,
      method,
    })
    await db
      .from('daily_attendance')
      .update({
        check_out_at: iso,
        worked_minutes: workedMinutes,
        net_worked_minutes: workedMinutes,
        status: 'present',
      })
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)

    return NextResponse.json({
      success: true,
      action: 'check_out',
      message: `تم تسجيل انصراف «${employee.full_name}» — ${workedMinutes} دقيقة`,
      employee_name: employee.full_name,
      check_in_at: day!.check_in_at,
      check_out_at: iso,
      worked_minutes: workedMinutes,
    })
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

    const wd = checkInAt.toISOString().slice(0, 10)
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
        work_date: wd,
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
