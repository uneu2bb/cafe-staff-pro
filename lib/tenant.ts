import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type TenantContext = {
  userId: string
  tenantId: string
  role: string
  fullName: string
}

/** يجلب سياق المستأجر للمستخدم الحالي (من الكوكيز) */
export async function requireTenant(
  roles: string[] = ['owner', 'manager', 'accountant']
): Promise<TenantContext | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const db = adminDb()
  const { data: profile } = await db
    .from('profiles')
    .select('id, role, tenant_id, full_name, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status === 'resigned') return null
  if (!profile.tenant_id) return null
  if (roles.length && !roles.includes(profile.role)) return null

  // تأكد أن المقهى نشط
  const { data: tenant } = await db
    .from('tenants')
    .select('id, status')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant || tenant.status !== 'active') return null

  return {
    userId: user.id,
    tenantId: profile.tenant_id,
    role: profile.role,
    fullName: profile.full_name || '',
  }
}

/** تسجيل مقهى جديد + مالك */
export async function createTenantWithOwner(input: {
  cafeName: string
  email: string
  password: string
  ownerName: string
}): Promise<{ ok: true; tenantId: string; userId: string } | { ok: false; error: string }> {
  const db = adminDb()
  const cafeName = input.cafeName.trim()
  const email = input.email.trim().toLowerCase()
  const ownerName = input.ownerName.trim()

  if (!cafeName || !email || !input.password || !ownerName) {
    return { ok: false, error: 'كل الحقول مطلوبة' }
  }
  if (input.password.length < 6) {
    return { ok: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  // slug بسيط من الاسم
  const baseSlug =
    cafeName
      .toLowerCase()
      .replace(/[^؀-ۿa-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'cafe'
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`

  // إنشاء مستخدم Auth
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  })

  if (authError || !authData.user) {
    const msg = authError?.message || 'فشل إنشاء الحساب'
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
      return { ok: false, error: 'هذا البريد مسجّل مسبقاً' }
    }
    return { ok: false, error: msg }
  }

  const userId = authData.user.id

  // إنشاء المقهى
  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .insert({
      name: cafeName,
      slug,
      owner_user_id: userId,
      status: 'active',
      plan: 'basic',
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    // تراجع: احذف المستخدم
    await db.auth.admin.deleteUser(userId)
    return { ok: false, error: tenantError?.message || 'فشل إنشاء المقهى' }
  }

  // بروفايل المالك
  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: userId,
      tenant_id: tenant.id,
      full_name: ownerName,
      role: 'owner',
      status: 'active',
      employee_number: 'OWNER',
      salary_amount: 0,
      work_hours_per_day: 8,
      pin_code: '0000',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    await db.from('tenants').delete().eq('id', tenant.id)
    await db.auth.admin.deleteUser(userId)
    return { ok: false, error: profileError.message }
  }

  // إعدادات افتراضية للمقهى
  await db.from('system_settings').upsert(
    [
      { tenant_id: tenant.id, key: 'rate_syp_per_usd', value: '15000', description: 'كم ليرة سورية مقابل 1 دولار' },
      { tenant_id: tenant.id, key: 'rate_try_per_usd', value: '34', description: 'كم ليرة تركية مقابل 1 دولار' },
      { tenant_id: tenant.id, key: 'admin_panel_password', value: '0000', description: 'كلمة مرور لوحة التحكم المخفية' },
    ],
    { onConflict: 'tenant_id,key' }
  )

  return { ok: true, tenantId: tenant.id, userId }
}
