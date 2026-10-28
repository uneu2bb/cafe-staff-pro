'use client'

import { useCallback, useEffect, useState } from 'react'

type TenantRow = {
  id: string
  name: string
  status: string
  owner_email: string
  owner_name: string
  employee_count: number
  created_at: string
}

export default function TenantsTab({ onToast }: { onToast: (ok: boolean, msg: string) => void }) {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/tenants')
      const data = await res.json()
      if (!res.ok) {
        setDenied(true)
        setTenants([])
      } else {
        setDenied(false)
        setTenants(data.tenants || [])
      }
    } catch {
      setDenied(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (tenant_id: string, action: 'suspend' | 'activate' | 'delete', name: string) => {
    if (action === 'delete') {
      if (!confirm(`حذف نهائي لـ «${name}»؟ سيتم مسح كل بياناته.`)) return
    }
    setBusyId(tenant_id)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id, action }),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل')
      else {
        onToast(true, data.message || 'تم')
        await load()
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setBusyId(null)
  }

  if (loading) return <p className="text-center text-zinc-500 py-6">...</p>
  if (denied) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">
        هالقسم للسوبر أدمن فقط. تأكد إن إيميلك مضبوط في SUPER_ADMIN_EMAILS
      </p>
    )
  }
  if (!tenants.length) {
    return <p className="text-sm text-zinc-500 text-center py-4">لا توجد حسابات بعد</p>
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {tenants.map((t) => {
        const active = t.status === 'active'
        return (
          <div key={t.id} className="card" style={{ padding: 12 }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-right flex-1">
                <p className="text-sm text-white font-medium">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  {t.owner_name || '—'} · {t.owner_email || 'بدون إيميل'}
                </p>
                <p className="text-xs text-zinc-600">
                  موظفين: {t.employee_count} ·{' '}
                  <span style={{ color: active ? '#6ee7b7' : '#fcd34d' }}>
                    {active ? 'نشط' : 'موقوف'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {active ? (
                <button
                  disabled={busyId === t.id}
                  onClick={() => act(t.id, 'suspend', t.name)}
                  className="text-xs px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#fcd34d',
                    border: '1px solid rgba(245,158,11,0.35)',
                  }}
                >
                  إيقاف
                </button>
              ) : (
                <button
                  disabled={busyId === t.id}
                  onClick={() => act(t.id, 'activate', t.name)}
                  className="text-xs px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16,185,129,0.35)',
                  }}
                >
                  تشغيل
                </button>
              )}
              <button
                disabled={busyId === t.id}
                onClick={() => act(t.id, 'delete', t.name)}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(220,38,38,0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(220,38,38,0.35)',
                }}
              >
                حذف
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
