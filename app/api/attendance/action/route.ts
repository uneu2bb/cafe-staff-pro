import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = adminDb()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager', 'supervisor', 'accountant'].includes(profile.role)) return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

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
    .select('id, full_name, status, branch_id')
    .eq('id', employee_id)
    .single()

  if (!employee || employee.status !== 'active') {
    return NextResponse.json({ error: 'الموظف غير متاح' }, { status: 404 })
  }

  // حفظ جلسة كاملة: حضور + انصراف بأوقات محددة
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

    // سجلات الحضور والانصراف
    await db.from('attendance_records').insert([
      {
        employee_id,
        record_type: 'check_in',
        recorded_at: checkInAt.toISOString(),
        branch_id: employee.branch_id,
        method: 'manual',
      },
      {
        employee_id,
        record_type: 'check_out',
        recorded_at: checkOutAt.toISOString(),
        branch_id: employee.branch_id,
        method: 'manual',
      },
    ])

    await db.from('daily_attendance').upsert({
      employee_id,
      work_date: workDate,
      branch_id: employee.branch_id,
      status: 'present',
      check_in_at: checkInAt.toISOString(),
      check_out_at: checkOutAt.toISOString(),
      worked_minutes: workedMinutes,
      net_worked_minutes: workedMinutes,
    }, { onConflict: 'employee_id,work_date' })

    const h = Math.floor(workedMinutes / 60)
    const m = workedMinutes % 60
    return NextResponse.json({
      success: true,
      message: `تم حفظ دوام ${employee.full_name}: ${h}:${String(m).padStart(2, '0')} ساعة`,
      worked_minutes: workedMinutes,
      check_in_at: checkInAt.toISOString(),
      check_out_at: checkOutAt.toISOString(),
    })
  }

  const now = new Date()
  const workDate = now.toISOString().slice(0, 10)
  const recordedAt = now.toISOString()

  if (action === 'check_in') {
    const { data: existing } = await db
      .from('daily_attendance')
      .select('id, check_in_at')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .maybeSingle()

    if (existing?.check_in_at) {
      return NextResponse.json({ success: false, error: 'تم تسجيل الحضور مسبقاً' }, { status: 409 })
    }

    await db.from('attendance_records').insert({
      employee_id,
      record_type: 'check_in',
      recorded_at: recordedAt,
      branch_id: employee.branch_id,
      method: 'manual',
    })

    await db.from('daily_attendance').upsert({
      employee_id,
      work_date: workDate,
      branch_id: employee.branch_id,
      status: 'present',
      check_in_at: recordedAt,
    }, { onConflict: 'employee_id,work_date' })

    return NextResponse.json({ success: true, message: `تم حضور ${employee.full_name}`, check_in_at: recordedAt })
  }

  if (action === 'check_out') {
    const { data: day } = await db
      .from('daily_attendance')
      .select('id, check_in_at, check_out_at')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .maybeSingle()

    if (!day?.check_in_at) {
      return NextResponse.json({ success: false, error: 'لا يوجد حضور اليوم' }, { status: 400 })
    }
    if (day.check_out_at) {
      return NextResponse.json({ success: false, error: 'تم تسجيل الانصراف مسبقاً' }, { status: 409 })
    }

    const workedMinutes = Math.round((now.getTime() - new Date(day.check_in_at).getTime()) / 60000)

    await db.from('attendance_records').insert({
      employee_id,
      record_type: 'check_out',
      recorded_at: recordedAt,
      branch_id: employee.branch_id,
      method: 'manual',
    })

    await db.from('daily_attendance').update({
      check_out_at: recordedAt,
      worked_minutes: workedMinutes,
      net_worked_minutes: workedMinutes,
      status: 'present',
    }).eq('id', day.id)

    return NextResponse.json({
      success: true,
      message: `تم انصراف ${employee.full_name}`,
      check_out_at: recordedAt,
      worked_minutes: workedMinutes,
    })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
