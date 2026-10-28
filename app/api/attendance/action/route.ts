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
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = adminDb()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager', 'supervisor'].includes(profile.role)) return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { employee_id, action, note } = body as {
    employee_id: string
    action: 'check_in' | 'check_out' | 'absent'
    note?: string
  }

  if (!employee_id || !['check_in', 'check_out', 'absent'].includes(action)) {
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  }

  const db = adminDb()
  const now = new Date()
  const workDate = now.toISOString().slice(0, 10)
  const recordedAt = now.toISOString()

  const { data: employee } = await db
    .from('profiles')
    .select('id, full_name, status, branch_id')
    .eq('id', employee_id)
    .single()

  if (!employee || employee.status !== 'active') {
    return NextResponse.json({ error: 'الموظف غير متاح' }, { status: 404 })
  }

  if (action === 'absent') {
    const { data: existing } = await db
      .from('daily_attendance')
      .select('id, status')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .maybeSingle()

    if (existing?.status === 'absent') {
      return NextResponse.json({ error: 'تم تسجيل الغياب مسبقاً اليوم' }, { status: 409 })
    }
    if (existing?.status === 'present' || existing?.status === 'late') {
      return NextResponse.json({ error: 'لا يمكن تسجيل غياب بعد الحضور' }, { status: 409 })
    }

    await db.from('daily_attendance').upsert({
      employee_id,
      work_date: workDate,
      branch_id: employee.branch_id,
      status: 'absent',
      notes: note || null,
    }, { onConflict: 'employee_id,work_date' })

    return NextResponse.json({
      success: true,
      message: `تم تسجيل غياب ${employee.full_name}`,
      status: 'absent',
    })
  }

  const recordType = action === 'check_in' ? 'check_in' : 'check_out'

  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: existingRec } = await db
    .from('attendance_records')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('record_type', recordType)
    .gte('recorded_at', dayStart.toISOString())
    .lte('recorded_at', dayEnd.toISOString())
    .limit(1)

  if (existingRec?.length) {
    return NextResponse.json({
      success: false,
      error: action === 'check_in' ? 'تم تسجيل الحضور مسبقاً' : 'تم تسجيل الانصراف مسبقاً',
    }, { status: 409 })
  }

  if (action === 'check_out') {
    const { data: checkIn } = await db
      .from('attendance_records')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('record_type', 'check_in')
      .gte('recorded_at', dayStart.toISOString())
      .lte('recorded_at', dayEnd.toISOString())
      .limit(1)
    if (!checkIn?.length) {
      return NextResponse.json({ error: 'يجب تسجيل الحضور أولاً' }, { status: 400 })
    }
  }

  const { error: insErr } = await db.from('attendance_records').insert({
    employee_id,
    branch_id: employee.branch_id,
    record_type: recordType,
    recorded_at: recordedAt,
    local_recorded_at: recordedAt,
    verification_method: 'manual',
    verification_status: 'success',
    is_offline: false,
    synced_at: recordedAt,
    notes: note || null,
    created_by: admin.id,
  })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  if (action === 'check_in') {
    await db.from('daily_attendance').upsert({
      employee_id,
      work_date: workDate,
      branch_id: employee.branch_id,
      check_in_at: recordedAt,
      status: 'present',
    }, { onConflict: 'employee_id,work_date' })
  } else {
    const { data: daily } = await db
      .from('daily_attendance')
      .select('check_in_at, break_minutes')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .single()

    if (daily?.check_in_at) {
      const mins = Math.floor((now.getTime() - new Date(daily.check_in_at).getTime()) / 60000)
      await db.from('daily_attendance').update({
        check_out_at: recordedAt,
        worked_minutes: mins,
        net_worked_minutes: mins - (daily.break_minutes || 0),
      }).eq('employee_id', employee_id).eq('work_date', workDate)
    }
  }

  return NextResponse.json({
    success: true,
    message: action === 'check_in'
      ? `تم تسجيل حضور ${employee.full_name}`
      : `تم تسجيل انصراف ${employee.full_name}`,
    status: action === 'check_in' ? 'present' : 'checked_out',
    recorded_at: recordedAt,
  })
}
