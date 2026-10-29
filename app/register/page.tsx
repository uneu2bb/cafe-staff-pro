import { redirect } from 'next/navigation'

/** التسجيل العام ملغى — إنشاء الحسابات من لوحة السوبر أدمن فقط */
export default function RegisterDisabled() {
  redirect('/login')
}
