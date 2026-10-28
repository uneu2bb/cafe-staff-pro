import { adminDb } from '@/lib/tenant'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** إيميلات السوبر أدمن (مفصولة بفاصلة) من متغير البيئة */
function superEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
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

  // 1) إيميل مصرّح من البيئة
  if (allowed.length && allowed.includes(email)) {
    return { userId: user.id, email }
  }

  // 2) دور super_admin في profiles
  const db = adminDb()
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'super_admin') {
    return { userId: user.id, email }
  }

  // 3) إذا ما في قائمة إيميلات بعد — أول owner يعتبر سوبر (مؤقت للتطوير)
  if (!allowed.length) {
    if (profile?.role === 'owner') {
      return { userId: user.id, email }
    }
  }

  return null
}
