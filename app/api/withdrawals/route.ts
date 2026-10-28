import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const employeeId = req.nextUrl.searchParams.get('employee_id')
  const db = adminDb()
  let q = db
    .from('employee_withdrawals')
    .select('id, employee_id, amount, currency, note, withdrawn_at')
    .eq('tenant_id', ctx.tenantId)
    .order('withdrawn_at', { ascending: false })
    .limit(100)

  if (employeeId) q = q.eq('employee_id', employeeId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ withdrawals: data || [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { employee_id, amount, currency = 'USD', note } = body

  if (!employee_id || !amount) {
    return NextResponse.json({ error: 'الموظف والمبلغ مطلوبان' }, { status: 400 })
  }

  const db = adminDb()
  const { data: emp } = await db
    .from('profiles')
    .select('id')
    .eq('id', employee_id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود في مقهاك' }, { status: 404 })

  const { data, error } = await db
    .from('employee_withdrawals')
    .insert({
      employee_id,
      tenant_id: ctx.tenantId,
      amount: Number(amount),
      currency,
      note: note || null,
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, withdrawal: data })
}
