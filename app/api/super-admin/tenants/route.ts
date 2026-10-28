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

  // عدد الموظفين + إيميل المالك لكل مقهى
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
    action: 'suspend' | 'activate' | 'delete'
    tenant_id: string
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

  if (action === 'delete') {
    // حذف نهائي: بيانات المقهى + حساب المالك
    // profiles / attendance / withdrawals مربوطة بـ ON DELETE CASCADE من tenants إن وُجد
    // نحذف يدوياً للتأكيد
    await db.from('employee_withdrawals').delete().eq('tenant_id', tenant_id)
    await db.from('attendance_records').delete().eq('tenant_id', tenant_id)
    await db.from('daily_attendance').delete().eq('tenant_id', tenant_id)
    await db.from('system_settings').delete().eq('tenant_id', tenant_id)

    // اجلب كل مستخدمي المقهى قبل حذف البروفايلات
    const { data: members } = await db.from('profiles').select('id').eq('tenant_id', tenant_id)

    await db.from('profiles').delete().eq('tenant_id', tenant_id)
    await db.from('tenants').delete().eq('id', tenant_id)

    // احذف حسابات Auth
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
