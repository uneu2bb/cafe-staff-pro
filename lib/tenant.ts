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

  // super_admin يمر كـ owner
  const effectiveRole = profile.role === 'super_admin' ? 'owner' : profile.role
  if (roles.length && !roles.includes(effectiveRole) && profile.role !== 'super_admin') {
    return null
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('id, status')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant || tenant.status !== 'active') return null

  return {
    userId: user.id,
    tenantId: profile.tenant_id,
    role: effectiveRole,
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

  if (!cafeName || cafeName.length < 2) return { ok: false, error: 'اسم المقهى قصير' }
  if (!email.includes('@')) return { ok: false, error: 'بريد غير صالح' }
  if (!input.password || input.password.length < 6) return { ok: false, error: 'كلمة المرور قصيرة' }

  const slugBase = cafeName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'cafe'
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: ownerName || cafeName },
  })
  if (authError || !authData.user) {
    return { ok: false, error: authError?.message || 'فشل إنشاء المستخدم' }
  }

  const userId = authData.user.id

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({ name: cafeName, slug, status: 'active', owner_user_id: userId, plan: 'basic' })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    try {
      await db.auth.admin.deleteUser(userId)
    } catch {}
    return { ok: false, error: tenantErr?.message || 'فشل إنشاء المقهى' }
  }

  const { error: profErr } = await db.from('profiles').upsert({
    id: userId,
    full_name: ownerName || cafeName,
    role: 'owner',
    status: 'active',
    tenant_id: tenant.id,
    employee_number: 'OWNER',
    pin_code: '0000',
  })

  if (profErr) {
    await db.from('tenants').delete().eq('id', tenant.id)
    try {
      await db.auth.admin.deleteUser(userId)
    } catch {}
    return { ok: false, error: profErr.message }
  }

  await db.from('system_settings').upsert(
    {
      tenant_id: tenant.id,
      key: 'admin_panel_password',
      value: '0000',
      description: 'كلمة مرور لوحة التحكم المخفية',
    },
    { onConflict: 'tenant_id,key' }
  )

  return { ok: true, tenantId: tenant.id, userId }
}
