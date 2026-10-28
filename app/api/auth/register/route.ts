import { NextRequest, NextResponse } from 'next/server'
import { createTenantWithOwner } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await createTenantWithOwner({
      cafeName: body.cafeName || body.cafe_name || '',
      email: body.email || '',
      password: body.password || '',
      ownerName: body.ownerName || body.owner_name || '',
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء حساب المقهى بنجاح. يمكنك تسجيل الدخول الآن.',
      tenantId: result.tenantId,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
