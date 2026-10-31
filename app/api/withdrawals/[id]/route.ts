import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'معرّف السحب مطلوب' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.amount !== undefined) {
    const n = Number(body.amount)
    if (!n || n <= 0) return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
    updates.amount = n
  }
  if (body.currency !== undefined) {
    const c = String(body.currency).toUpperCase()
    if (!['USD', 'SYP', 'TRY'].includes(c)) {
      return NextResponse.json({ error: 'عملة غير مدعومة' }, { status: 400 })
    }
    updates.currency = c
  }
  if (body.note !== undefined) updates.note = body.note || null
  if (body.employee_id !== undefined) updates.employee_id = body.employee_id

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'لا يوجد شيء للتعديل' }, { status: 400 })
  }

  const db = adminDb()

  if (updates.employee_id) {
    const { data: emp } = await db
      .from('profiles')
      .select('id')
      .eq('id', updates.employee_id as string)
      .eq('tenant_id', ctx.tenantId)
      .single()
    if (!emp) return NextResponse.json({ error: 'موظف غير موجود في مقهاك' }, { status: 404 })
  }

  const { data, error } = await db
    .from('employee_withdrawals')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select('id, employee_id, amount, currency, note, withdrawn_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'السحب غير موجود' }, { status: 404 })
  return NextResponse.json({ success: true, withdrawal: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager', 'accountant'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'معرّف السحب مطلوب' }, { status: 400 })

  const db = adminDb()
  const { data, error } = await db
    .from('employee_withdrawals')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'السحب غير موجود' }, { status: 404 })
  return NextResponse.json({ success: true })
}
