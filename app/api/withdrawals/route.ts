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

async function requireAdmin() {
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
  if (!profile || !['owner', 'manager', 'accountant'].includes(profile.role)) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const db = adminDb()
  const employeeId = req.nextUrl.searchParams.get('employee_id')

  let q = db
    .from('employee_withdrawals')
    .select('id, employee_id, amount, currency, note, withdrawn_at, profiles:employee_id(full_name, employee_number)')
    .order('withdrawn_at', { ascending: false })
    .limit(200)

  if (employeeId) q = q.eq('employee_id', employeeId)

  const { data, error } = await q
  if (error) {
    // الجدول غير موجود بعد
    if (error.message?.includes('employee_withdrawals') || error.code === 'PGRST205') {
      return NextResponse.json({ withdrawals: [], need_migration: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: settings } = await db.from('system_settings').select('key, value')
  const rates: Record<string, number> = { USD: 1, SYP: 15000, TRY: 34 }
  for (const s of settings || []) {
    if (s.key === 'rate_syp_per_usd') rates.SYP = Number(s.value) || 15000
    if (s.key === 'rate_try_per_usd') rates.TRY = Number(s.value) || 34
  }

  let totalUsd = 0
  let sumUsd = 0, sumSyp = 0, sumTry = 0
  for (const w of data || []) {
    const amt = Number(w.amount) || 0
    if (w.currency === 'USD') { sumUsd += amt; totalUsd += amt }
    else if (w.currency === 'SYP') { sumSyp += amt; totalUsd += amt / rates.SYP }
    else if (w.currency === 'TRY') { sumTry += amt; totalUsd += amt / rates.TRY }
  }

  return NextResponse.json({
    withdrawals: data || [],
    rates,
    totals: { USD: sumUsd, SYP: sumSyp, TRY: sumTry, total_usd: totalUsd },
  })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { employee_id, amount, currency, note } = body

  if (!employee_id || !amount || !['USD', 'SYP', 'TRY'].includes(currency)) {
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  }

  const db = adminDb()
  const { data, error } = await db.from('employee_withdrawals').insert({
    employee_id,
    amount: Number(amount),
    currency,
    note: note || null,
    created_by: user.id,
  }).select().single()

  if (error) {
    if (error.message?.includes('employee_withdrawals') || error.code === 'PGRST205') {
      return NextResponse.json({
        error: 'يجب تنفيذ SQL لإنشاء جدول السحوبات أولاً (ملف supabase/withdrawals.sql)',
        need_migration: true,
      }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ withdrawal: data })
}
