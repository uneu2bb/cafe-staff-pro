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
  if (!profile || !['owner', 'manager'].includes(profile.role)) return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const db = adminDb()
  // employee_status enum: active | suspended | resigned (لا يوجد archived)
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, employee_number, salary_amount, salary_type, hire_date, work_hours_per_day, weekly_off_days, status, job_title, phone, notes, pin_code, role')
    .in('status', ['active', 'suspended'])
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const {
    full_name,
    employee_number,
    salary_amount,
    hire_date,
    work_hours_per_day = 8,
    weekly_off_days = [5, 6],
    job_title,
    phone,
    notes,
    pin_code = '0000',
  } = body

  if (!full_name || !employee_number) {
    return NextResponse.json({ error: 'الاسم والرقم الوظيفي مطلوبان' }, { status: 400 })
  }

  const db = adminDb()

  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('employee_number', String(employee_number).trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'الرقم الوظيفي مستخدم مسبقاً' }, { status: 409 })
  }

  const empNo = String(employee_number).trim()
  const email = `emp${empNo}@cafestaff.local`
  const password = `Emp${empNo}!${pin_code || '0000'}`

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: String(full_name).trim(), role: 'employee' },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'فشل إنشاء الحساب' }, { status: 500 })
  }

  const { data, error } = await db.from('profiles').update({
    full_name: String(full_name).trim(),
    employee_number: empNo,
    salary_amount: Number(salary_amount) || 0,
    salary_type: 'monthly',
    hire_date: hire_date || null,
    work_hours_per_day: Number(work_hours_per_day) || 8,
    weekly_off_days: weekly_off_days || [5, 6],
    job_title: job_title || null,
    phone: phone || null,
    notes: notes || null,
    pin_code: String(pin_code),
    role: 'employee',
    status: 'active',
  }).eq('id', authData.user.id).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employee: data })
}
