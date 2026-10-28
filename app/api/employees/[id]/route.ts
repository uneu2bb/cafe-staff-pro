import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const db = adminDb()

  // تأكد أن الموظف يتبع نفس المقهى
  const { data: emp } = await db
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن تعديل حساب المالك من هنا' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.full_name != null) patch.full_name = String(body.full_name).trim()
  if (body.salary_amount != null) patch.salary_amount = Number(body.salary_amount) || 0
  if (body.work_hours_per_day != null) patch.work_hours_per_day = Number(body.work_hours_per_day) || 8
  if (body.job_title !== undefined) patch.job_title = body.job_title || null
  if (body.phone !== undefined) patch.phone = body.phone || null
  if (body.notes !== undefined) patch.notes = body.notes || null
  if (body.pin_code !== undefined) patch.pin_code = String(body.pin_code || '0000')
  if (body.status != null) patch.status = body.status

  const { data, error } = await db
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, employee: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const db = adminDb()

  const { data: emp } = await db
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!emp) return NextResponse.json({ error: 'موظف غير موجود' }, { status: 404 })
  if (emp.role === 'owner') {
    return NextResponse.json({ error: 'لا يمكن حذف المالك' }, { status: 400 })
  }

  // soft delete
  const { error } = await db
    .from('profiles')
    .update({ status: 'resigned' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
