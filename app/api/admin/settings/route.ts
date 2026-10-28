import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireOwner() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = adminDb()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'owner') return null
  return user
}

export async function GET() {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const db = adminDb()
  const { data } = await db.from('system_settings').select('key, value')
  const map: Record<string, string> = {}
  for (const row of data || []) map[row.key] = row.value
  return NextResponse.json({
    email: user.email,
    rate_syp_per_usd: map.rate_syp_per_usd || '15000',
    rate_try_per_usd: map.rate_try_per_usd || '34',
    has_panel_password: !!(map.admin_panel_password),
  })
}

export async function POST(req: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { action } = body
  const db = adminDb()

  if (action === 'verify_panel') {
    const { data } = await db.from('system_settings').select('value').eq('key', 'admin_panel_password').maybeSingle()
    const stored = data?.value || '0000'
    if (String(body.password) !== stored) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }
    return NextResponse.json({ success: true })
  }

  if (action === 'update_rates') {
    const syp = String(body.rate_syp_per_usd || '15000')
    const tryR = String(body.rate_try_per_usd || '34')
    await db.from('system_settings').upsert([
      { key: 'rate_syp_per_usd', value: syp, description: 'SYP per 1 USD' },
      { key: 'rate_try_per_usd', value: tryR, description: 'TRY per 1 USD' },
    ], { onConflict: 'key' })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_panel_password') {
    const pwd = String(body.password || '').trim()
    if (pwd.length < 4) return NextResponse.json({ error: 'كلمة المرور قصيرة' }, { status: 400 })
    await db.from('system_settings').upsert({
      key: 'admin_panel_password',
      value: pwd,
      description: 'لوحة التحكم المخفية',
    }, { onConflict: 'key' })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_account_password') {
    const pwd = String(body.password || '')
    if (pwd.length < 6) return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 400 })
    const { error } = await db.auth.admin.updateUserById(user.id, { password: pwd })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_email') {
    const email = String(body.email || '').trim()
    if (!email.includes('@')) return NextResponse.json({ error: 'بريد غير صالح' }, { status: 400 })
    const { error } = await db.auth.admin.updateUserById(user.id, { email, email_confirm: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
