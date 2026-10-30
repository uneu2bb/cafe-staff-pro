import { adminDb } from '@/lib/tenant'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function superEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** يجلب معرفات السوبر أدمن المحفوظة في قاعدة البيانات (تبقى بعد تغيير الإيميل) */
async function platformAdminIds(db: ReturnType<typeof adminDb>): Promise<Set<string>> {
  const { data } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'platform_admin_user_ids')

  const ids = new Set<string>()
  for (const row of data || []) {
    for (const part of String(row.value || '').split(',')) {
      const id = part.trim()
      if (id) ids.add(id)
    }
  }
  return ids
}

/** يحفظ معرف المستخدم كسوبر أدمن في القاعدة */
export async function ensurePlatformAdminUserId(userId: string, tenantId?: string) {
  const db = adminDb()
  const ids = await platformAdminIds(db)
  if (ids.has(userId)) return

  ids.add(userId)
  const value = Array.from(ids).join(',')

  // خزّن على tenant الخاص بالمستخدم إن وُجد
  let tid = tenantId
  if (!tid) {
    const { data: prof } = await db
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle()
    tid = prof?.tenant_id || undefined
  }
  if (!tid) return

  await db.from('system_settings').upsert(
    {
      tenant_id: tid,
      key: 'platform_admin_user_ids',
      value,
      description: 'معرفات السوبر أدمن (تبقى عند تغيير الإيميل)',
    },
    { onConflict: 'tenant_id,key' }
  )
}

export async function requireSuperAdmin(): Promise<
  { userId: string; email: string } | null
> {
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
  if (!user?.email) return null

  const email = user.email.toLowerCase()
  const allowed = superEmails()
  const db = adminDb()

  // 1) إيميل مصرّح من البيئة
  if (allowed.length && allowed.includes(email)) {
    // ثبّت المعرف حتى لو غيّر الإيميل لاحقاً
    await ensurePlatformAdminUserId(user.id)
    return { userId: user.id, email }
  }

  // 2) معرف محفوظ في القاعدة (لا يتأثر بتغيير الإيميل)
  const idSet = await platformAdminIds(db)
  if (idSet.has(user.id)) {
    return { userId: user.id, email }
  }

  // 3) إذا ما في قائمة إيميلات بعد — أول owner
  if (!allowed.length) {
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role === 'owner') {
      await ensurePlatformAdminUserId(user.id)
      return { userId: user.id, email }
    }
  }

  return null
}
