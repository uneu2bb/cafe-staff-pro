import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/tenant'
import { requireSuperAdmin } from '@/lib/superAdmin'

export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'غير مصرح — سوبر أدمن فقط' }, { status: 403 })

  const db = adminDb()
  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, name, slug, status, plan, owner_user_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = []
  for (const t of tenants || []) {
    const { count } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .eq('role', 'employee')
      .neq('status', 'resigned')

    let ownerEmail = ''
    let ownerName = ''
    if (t.owner_user_id) {
      const { data: userData } = await db.auth.admin.getUserById(t.owner_user_id)
      ownerEmail = userData?.user?.email || ''
      const { data: prof } = await db
        .from('profiles')
        .select('full_name')
        .eq('id', t.owner_user_id)
        .maybeSingle()
      ownerName = prof?.full_name || ''
    }

    enriched.push({
      ...t,
      employee_count: count || 0,
      owner_email: ownerEmail,
      owner_name: ownerName,
    })
  }

  return NextResponse.json({ tenants: enriched })
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'غير مصرح — سوبر أدمن فقط' }, { status: 403 })

  const body = await req.json()
  const { action, tenant_id } = body as {
    action: 'suspend' | 'activate' | 'delete' | 'set_email' | 'set_password' | 'set_cafe_name'
    tenant_id: string
    email?: string
    password?: string
    cafe_name?: string
  }

  if (!tenant_id || !action) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  const db = adminDb()

  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, owner_user_id, status')
    .eq('id', tenant_id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'المقهى غير موجود' }, { status: 404 })

  if (action === 'suspend') {
    await db.from('tenants').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', tenant_id)
    return NextResponse.json({ success: true, message: `تم إيقاف «${tenant.name}»` })
  }

  if (action === 'activate') {
    await db.from('tenants').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', tenant_id)
    return NextResponse.json({ success: true, message: `تم تفعيل «${tenant.name}»` })
  }

  if (action === 'set_cafe_name') {
    const name = String(body.cafe_name || '').trim()
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'اسم قصير جداً' }, { status: 400 })
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'اسم طويل جداً' }, { status: 400 })
    }
    const { error } = await db
      .from('tenants')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', tenant_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: `تم تغيير اسم المقهى إلى «${name}»` })
  }

  if (action === 'set_email') {
    if (!tenant.owner_user_id) {
      return NextResponse.json({ error: 'لا يوجد حساب مالك مرتبط' }, { status: 400 })
    }
    const email = String(body.email || '').trim().toLowerCase()
    if (!email.includes('@') || email.length < 5) {
      return NextResponse.json({ error: 'بريد غير صالح' }, { status: 400 })
    }
    const { error } = await db.auth.admin.updateUserById(tenant.owner_user_id, { email })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, message: `تم تغيير بريد «${tenant.name}»` })
  }

  if (action === 'set_password') {
    if (!tenant.owner_user_id) {
      return NextResponse.json({ error: 'لا يوجد حساب مالك مرتبط' }, { status: 400 })
    }
    const password = String(body.password || '')
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 400 })
    }
    const { error } = await db.auth.admin.updateUserById(tenant.owner_user_id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, message: `تم تغيير كلمة سر «${tenant.name}»` })
  }

  if (action === 'delete') {
    await db.from('employee_withdrawals').delete().eq('tenant_id', tenant_id)
    await db.from('attendance_records').delete().eq('tenant_id', tenant_id)
    await db.from('daily_attendance').delete().eq('tenant_id', tenant_id)
    await db.from('system_settings').delete().eq('tenant_id', tenant_id)

    const { data: members } = await db.from('profiles').select('id').eq('tenant_id', tenant_id)

    await db.from('profiles').delete().eq('tenant_id', tenant_id)
    await db.from('tenants').delete().eq('id', tenant_id)

    for (const m of members || []) {
      try {
        await db.auth.admin.deleteUser(m.id)
      } catch {
        /* تجاهل */
      }
    }

    return NextResponse.json({ success: true, message: `تم حذف «${tenant.name}» نهائياً` })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
