import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireTenant } from '@/lib/tenant'

export async function GET() {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const db = adminDb()
  const { data: settings } = await db
    .from('system_settings')
    .select('key, value')
    .eq('tenant_id', ctx.tenantId)

  const map: Record<string, string> = {}
  for (const s of settings || []) map[s.key] = s.value

  const { data: userData } = await db.auth.admin.getUserById(ctx.userId)
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name')
    .eq('id', ctx.tenantId)
    .single()

  return NextResponse.json({
    email: userData?.user?.email || '',
    cafe_name: tenant?.name || '',
    rate_syp_per_usd: map.rate_syp_per_usd || '15000',
    rate_try_per_usd: map.rate_try_per_usd || '34',
    tenantId: ctx.tenantId,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(['owner', 'manager'])
  if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { action } = body
  const db = adminDb()

  if (action === 'verify_panel') {
    const { data: row } = await db
      .from('system_settings')
      .select('value')
      .eq('tenant_id', ctx.tenantId)
      .eq('key', 'admin_panel_password')
      .maybeSingle()

    const expected = row?.value || '0000'
    if (String(body.password || '') !== expected) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 403 })
    }
    return NextResponse.json({ success: true })
  }

  if (action === 'update_cafe_name') {
    const name = String(body.cafe_name || body.name || '').trim()
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'اسم الكافيه قصير جداً' }, { status: 400 })
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'اسم الكافيه طويل جداً' }, { status: 400 })
    }
    // فقط المالك يعدّل الاسم
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }
    const { error } = await db
      .from('tenants')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', ctx.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, cafe_name: name })
  }

  if (action === 'update_panel_password') {
    const pwd = String(body.password || '').trim()
    if (pwd.length < 4) {
      return NextResponse.json({ error: 'كلمة المرور قصيرة' }, { status: 400 })
    }
    await db.from('system_settings').upsert(
      {
        tenant_id: ctx.tenantId,
        key: 'admin_panel_password',
        value: pwd,
        description: 'كلمة مرور لوحة التحكم المخفية',
      },
      { onConflict: 'tenant_id,key' }
    )
    return NextResponse.json({ success: true })
  }

  if (action === 'update_rates') {
    const syp = String(body.rate_syp_per_usd || '15000')
    const tryR = String(body.rate_try_per_usd || '34')
    await db.from('system_settings').upsert(
      [
        {
          tenant_id: ctx.tenantId,
          key: 'rate_syp_per_usd',
          value: syp,
          description: 'كم ليرة سورية مقابل 1 دولار',
        },
        {
          tenant_id: ctx.tenantId,
          key: 'rate_try_per_usd',
          value: tryR,
          description: 'كم ليرة تركية مقابل 1 دولار',
        },
      ],
      { onConflict: 'tenant_id,key' }
    )
    return NextResponse.json({ success: true })
  }

  if (action === 'update_email') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'بريد غير صالح' }, { status: 400 })
    }
    const { error } = await db.auth.admin.updateUserById(ctx.userId, { email })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_password') {
    const password = String(body.password || '')
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور قصيرة' }, { status: 400 })
    }
    const { error } = await db.auth.admin.updateUserById(ctx.userId, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
