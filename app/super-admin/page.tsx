'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TenantRow = {
  id: string
  name: string
  slug: string | null
  status: string
  plan: string
  owner_email: string
  owner_name: string
  employee_count: number
  created_at: string
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/super-admin/tenants')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'غير مصرح')
        setTenants([])
      } else {
        setTenants(data.tenants || [])
      }
    } catch {
      setError('خطأ اتصال')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (tenant_id: string, action: 'suspend' | 'activate' | 'delete', name: string) => {
    if (action === 'delete') {
      const ok = confirm(`حذف نهائي لمقهى «${name}»؟\nسيتم مسح كل الموظفين والحضور والسحوبات وحساب المالك.\nلا يمكن التراجع.`)
      if (!ok) return
    }
    setBusyId(tenant_id)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast(data.error || 'فشل')
      } else {
        setToast(data.message || 'تم')
        await load()
      }
    } catch {
      setToast('خطأ اتصال')
    }
    setBusyId(null)
    setTimeout(() => setToast(''), 3000)
  }

  const statusLabel = (s: string) => {
    if (s === 'active') return { t: 'نشط', c: '#6ee7b7' }
    if (s === 'suspended') return { t: 'موقوف', c: '#fcd34d' }
    return { t: s, c: '#a1a1aa' }
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0a0f0c 0%, #0a0a0a 40%, #12100a 100%)' }}
    >
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium text-white"
          style={{ background: 'rgba(16,185,129,0.95)' }}
        >
          {toast}
        </div>
      )}

      <header
        className="sticky top-0 z-20 border-b border-zinc-800/80"
        style={{ background: 'rgba(10,12,11,0.9)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white text-base">لوحة التحكم العليا</h1>
            <p className="text-xs text-zinc-500">إدارة حسابات المقاهي</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="btn-secondary text-sm px-3 py-2">
              لوحة المقهى
            </Link>
            <button onClick={() => load()} className="btn-secondary text-sm px-3 py-2">
              تحديث
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-center text-zinc-500 py-16">...</p>
        ) : error ? (
          <div className="card text-center space-y-3">
            <p className="text-red-400">{error}</p>
            <p className="text-zinc-500 text-sm">
              أضف إيميلك في متغير البيئة <code className="text-amber-400">SUPER_ADMIN_EMAILS</code> على
              Vercel
            </p>
            <button onClick={() => router.push('/dashboard')} className="btn-secondary">
              رجوع
            </button>
          </div>
        ) : tenants.length === 0 ? (
          <p className="text-center text-zinc-500 py-16">لا توجد مقاهي بعد</p>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => {
              const st = statusLabel(t.status)
              return (
                <div key={t.id} className="card" style={{ padding: 16 }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="text-right flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        <h3 className="font-bold text-white">{t.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: 'rgba(39,39,42,0.8)' }}>
                          {st.t}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {t.owner_name || '—'} · {t.owner_email || 'بدون إيميل'}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        موظفين: {t.employee_count} · {new Date(t.created_at).toLocaleDateString('ar')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {t.status === 'active' ? (
                        <button
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'suspend', t.name)}
                          className="text-xs px-3 py-2 rounded-xl font-medium"
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
                          className="text-xs px-3 py-2 rounded-xl font-medium"
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
                        className="text-xs px-3 py-2 rounded-xl font-medium"
                        style={{
                          background: 'rgba(220,38,38,0.15)',
                          color: '#fca5a5',
                          border: '1px solid rgba(220,38,38,0.35)',
                        }}
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
