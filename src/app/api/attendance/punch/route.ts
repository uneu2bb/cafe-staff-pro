import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employee_number, pin, type, verification_method = 'pin' } = body

    if (!employee_number || !type || !['check_in', 'check_out'].includes(type)) {
      return NextResponse.json({ success: false, error: 'بيانات غير مكتملة' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: employee, error: empError } = await supabase
      .from('profiles')
      .select('id, full_name, status, pin_code, branch_id')
      .eq('employee_number', String(employee_number).trim())
      .single()

    if (empError || !employee) {
      return NextResponse.json({ success: false, error: 'الرقم الوظيفي غير موجود' }, { status: 404 })
    }
    if (employee.status !== 'active') {
      return NextResponse.json({ success: false, error: 'حساب الموظف غير نشط' }, { status: 403 })
    }
    if (verification_method === 'pin') {
      if (!pin) return NextResponse.json({ success: false, error: 'أدخل الرمز السري' }, { status: 400 })
      if (employee.pin_code && employee.pin_code !== String(pin)) {
        return NextResponse.json({ success: false, error: 'الرمز السري غير صحيح' }, { status: 401 })
      }
    }

    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('record_type', type)
      .gte('recorded_at', todayStart.toISOString())
      .lte('recorded_at', todayEnd.toISOString())
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({
        success: false,
        error: type === 'check_in' ? 'تم تسجيل حضورك مسبقاً اليوم' : 'تم تسجيل انصرافك مسبقاً اليوم',
      }, { status: 409 })
    }

    if (type === 'check_out') {
      const { data: checkIn } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('record_type', 'check_in')
        .gte('recorded_at', todayStart.toISOString())
        .lte('recorded_at', todayEnd.toISOString())
        .limit(1)
      if (!checkIn?.length) {
        return NextResponse.json({ success: false, error: 'يجب تسجيل الحضور أولاً' }, { status: 400 })
      }
    }

    const recordedAt = now.toISOString()
    const { error: insertError } = await supabase.from('attendance_records').insert({
      employee_id: employee.id,
      branch_id: employee.branch_id,
      record_type: type,
      recorded_at: recordedAt,
      local_recorded_at: recordedAt,
      verification_method,
      verification_status: 'success',
      is_offline: false,
      synced_at: recordedAt,
    })

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    const workDate = recordedAt.slice(0, 10)
    if (type === 'check_in') {
      await supabase.from('daily_attendance').upsert({
        employee_id: employee.id,
        work_date: workDate,
        branch_id: employee.branch_id,
        check_in_at: recordedAt,
        status: 'present',
      }, { onConflict: 'employee_id,work_date' })
    } else {
      const { data: daily } = await supabase.from('daily_attendance').select('check_in_at, break_minutes').eq('employee_id', employee.id).eq('work_date', workDate).single()
      if (daily?.check_in_at) {
        const mins = Math.floor((now.getTime() - new Date(daily.check_in_at).getTime()) / 60000)
        await supabase.from('daily_attendance').update({
          check_out_at: recordedAt,
          worked_minutes: mins,
          net_worked_minutes: mins - (daily.break_minutes || 0),
        }).eq('employee_id', employee.id).eq('work_date', workDate)
      }
    }

    return NextResponse.json({
      success: true,
      message: type === 'check_in' ? 'تم تسجيل الحضور بنجاح' : 'تم تسجيل الانصراف بنجاح',
      employee_name: employee.full_name,
      recorded_at: recordedAt,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'خطأ' }, { status: 500 })
  }
}
