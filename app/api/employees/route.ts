import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function GET() {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const db = adminDb()
  const { data, error } = await db
    .from('profiles')
    .select(
      'id, full_name, employee_number, salary_amount, salary_type, hire_date, work_hours_per_day, weekly_off_days, status, job_title, phone, notes, pin_code, role'
    )
    .eq('tenant_id', ctx.tenantId)
    .neq('role', 'owner') // المالك مو موظف في القائمة
    .in('status', ['active', 'suspended'])
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data || [], tenantId: ctx.tenantId })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

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

  // الرقم الوظيفي فريد داخل نفس المقهى فقط
  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('employee_number', String(employee_number).trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'الرقم الوظيفي مستخدم في مقهاك' }, { status: 400 })
  }

  // موظف بدون حساب دخول (auth) — سجل بروفايل فقط مربوط بالمقهى
  // نستخدم UUID جديد كمعرف
  const newId = crypto.randomUUID()

  const { data, error } = await db
    .from('profiles')
    .insert({
      id: newId,
      tenant_id: ctx.tenantId,
      full_name: String(full_name).trim(),
      employee_number: String(employee_number).trim(),
      salary_amount: Number(salary_amount) || 0,
      salary_type: 'monthly',
      hire_date: hire_date || new Date().toISOString().slice(0, 10),
      work_hours_per_day: Number(work_hours_per_day) || 8,
      weekly_off_days: weekly_off_days || [5, 6],
      job_title: job_title || null,
      phone: phone || null,
      notes: notes || null,
      pin_code: String(pin_code || '0000'),
      role: 'employee',
      status: 'active',
    })
    .select('id, full_name, employee_number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, employee: data })
}
