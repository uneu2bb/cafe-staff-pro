import { redirect } from 'next/navigation'

/** تم إغلاق الصفحة العامة — الإدارة من لوحة التحكم المخفية فقط */
export default function SuperAdminDisabled() {
  redirect('/dashboard')
}
