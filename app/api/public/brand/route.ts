import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/tenant'

export async function GET() {
  try {
    const db = adminDb()

    // اسم المنصة من إعداد عام إن وُجد
    const { data: platform } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'platform_display_name')
      .limit(1)
      .maybeSingle()

    if (platform?.value) {
      return NextResponse.json({ name: platform.value })
    }

    // وإلا اسم مقهى السوبر أدمن
    const emails = (process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (emails.length) {
      for (const email of emails) {
        const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
        const user = list?.users?.find((u) => (u.email || '').toLowerCase() === email)
        if (user) {
          const { data: prof } = await db
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle()
          if (prof?.tenant_id) {
            const { data: tenant } = await db
              .from('tenants')
              .select('name')
              .eq('id', prof.tenant_id)
              .maybeSingle()
            if (tenant?.name) {
              return NextResponse.json({ name: tenant.name })
            }
          }
        }
      }
    }

    return NextResponse.json({ name: 'Cafe Staff Pro' })
  } catch {
    return NextResponse.json({ name: 'Cafe Staff Pro' })
  }
}
