export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeBoard from './HomeBoard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, employee_number')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (!isAdmin) redirect('/kiosk')

  return (
    <HomeBoard
      adminName={profile?.full_name || user.email || ''}
      adminRole={profile?.role || 'owner'}
    />
  )
}
