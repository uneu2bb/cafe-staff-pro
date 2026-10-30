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
  is_protected?: boolean
  is_platform_admin?: boolean
}

export default function TenantsTab({ onToast }: { onToast: (ok: boolean, msg: string) => void }) {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [editTarget, setEditTarget] = useState<TenantRow | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editCafeName, setEditCafeName] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    cafeName: '',
    ownerName: '',
    email: '',
    password: '',
  })
  const [createBusy, setCreateBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  const act = async (tenant_id: string, action: 'suspend' | 'activate', name: string) => {
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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (!deletePassword) {
      onToast(false, 'أدخل كلمة سر حسابك للتأكيد')
      return
    }
    setDeleteBusy(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: deleteTarget.id,
          action: 'delete',
          confirm_password: deletePassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل')
      else {
        onToast(true, data.message || 'تم الحذف')
        setDeleteTarget(null)
        setDeletePassword('')
        await load()
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setDeleteBusy(false)
  }

  const openEdit = (t: TenantRow) => {
    setEditTarget(t)
    setEditEmail(t.owner_email || '')
    setEditPassword('')
    setEditCafeName(t.name || '')
  }

  const saveCafeName = async () => {
    if (!editTarget) return
    setEditBusy(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: editTarget.id, action: 'set_cafe_name', cafe_name: editCafeName }),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل')
      else {
        onToast(true, data.message || 'تم')
        await load()
        setEditTarget((prev) => (prev ? { ...prev, name: editCafeName.trim() } : null))
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setEditBusy(false)
  }

  const saveEmail = async () => {
    if (!editTarget) return
    setEditBusy(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: editTarget.id, action: 'set_email', email: editEmail }),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل')
      else {
        onToast(true, data.message || 'تم')
        await load()
        setEditTarget((prev) => (prev ? { ...prev, owner_email: editEmail.trim().toLowerCase() } : null))
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setEditBusy(false)
  }

  const savePassword = async () => {
    if (!editTarget) return
    setEditBusy(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: editTarget.id, action: 'set_password', password: editPassword }),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل')
      else {
        onToast(true, data.message || 'تم')
        setEditPassword('')
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setEditBusy(false)
  }

  const createAccount = async () => {
    if (!createForm.cafeName.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      onToast(false, 'أكمل الحقول المطلوبة')
      return
    }
    if (createForm.password.length < 6) {
      onToast(false, 'كلمة المرور 6 أحرف على الأقل')
      return
    }
    setCreateBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok) onToast(false, data.error || 'فشل الإنشاء')
      else {
        onToast(true, data.message || 'تم إنشاء الحساب')
        setShowCreate(false)
        setCreateForm({ cafeName: '', ownerName: '', email: '', password: '' })
        await load()
      }
    } catch {
      onToast(false, 'خطأ اتصال')
    }
    setCreateBusy(false)
  }

  if (loading) return <p className="text-center text-zinc-500 py-6">...</p>
  if (denied) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">
        هالقسم للسوبر أدمن فقط. تأكد إن إيميلك مضبوط في SUPER_ADMIN_EMAILS
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #059669, #d97706)' }}
      >
        + إنشاء حساب زبون
      </button>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {!tenants.length ? (
          <p className="text-sm text-zinc-500 text-center py-4">لا توجد حسابات بعد</p>
        ) : (
          tenants.map((t) => {
            const active = t.status === 'active'
            return (
              <div key={t.id} className="card" style={{ padding: 12 }}>
                <div className="text-right flex-1 mb-2">
                  <p className="text-sm text-white font-medium">
                    {t.name}
                    {t.is_protected ? (
                      <span className="text-[10px] text-amber-400 mr-2">محمي</span>
                    ) : null}
                    {t.is_platform_admin ? (
                      <span className="text-[10px] text-purple-300 mr-2">أدمن</span>
                    ) : null}
                  </p>
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
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    disabled={busyId === t.id}
                    onClick={() => openEdit(t)}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(59,130,246,0.35)',
                    }}
                  >
                    تعديل الحساب
                  </button>
                  {!t.is_protected &&
                    (active ? (
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
                    ))}
                  {!t.is_platform_admin && t.owner_email && (
                    <button
                      disabled={busyId === t.id}
                      onClick={async () => {
                        setBusyId(t.id)
                        try {
                          const res = await fetch('/api/super-admin/tenants', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenant_id: t.id, action: 'make_platform_admin' }),
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
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{
                        background: 'rgba(168,85,247,0.15)',
                        color: '#d8b4fe',
                        border: '1px solid rgba(168,85,247,0.35)',
                      }}
                    >
                      جعله أدمن
                    </button>
                  )}
                  {!t.is_protected && (
                    <button
                      disabled={busyId === t.id}
                      onClick={() => {
                        setDeleteTarget(t)
                        setDeletePassword('')
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{
                        background: 'rgba(220,38,38,0.15)',
                        color: '#fca5a5',
                        border: '1px solid rgba(220,38,38,0.35)',
                      }}
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 space-y-3"
            style={{ background: '#18181b', border: '1px solid #3f3f46' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-base">إنشاء حساب زبون</h3>
            <div>
              <label className="label">اسم المقهى *</label>
              <input
                className="input-field"
                value={createForm.cafeName}
                onChange={(e) => setCreateForm({ ...createForm, cafeName: e.target.value })}
                style={{ textAlign: 'right' }}
              />
            </div>
            <div>
              <label className="label">اسم المالك</label>
              <input
                className="input-field"
                value={createForm.ownerName}
                onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                style={{ textAlign: 'right' }}
              />
            </div>
            <div>
              <label className="label">البريد *</label>
              <input
                className="input-field"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
            </div>
            <div>
              <label className="label">كلمة المرور *</label>
              <input
                type="password"
                className="input-field"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                dir="ltr"
              />
            </div>
            <button disabled={createBusy} onClick={createAccount} className="btn-primary w-full">
              {createBusy ? '...' : 'إنشاء وتسليم للزبون'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary w-full">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 space-y-3"
            style={{ background: '#18181b', border: '1px solid #7f1d1d' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-red-300 font-bold text-base">تأكيد الحذف النهائي</h3>
            <p className="text-sm text-zinc-400">
              سيتم حذف «{deleteTarget.name}» وكل بياناته. أدخل <b className="text-white">كلمة سر حسابك أنت</b> للتأكيد.
            </p>
            <input
              type="password"
              className="input-field"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="كلمة سر حسابك"
              dir="ltr"
            />
            <button
              disabled={deleteBusy || !deletePassword}
              onClick={confirmDelete}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#dc2626' }}
            >
              {deleteBusy ? '...' : 'حذف نهائي'}
            </button>
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary w-full">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {editTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setEditTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 space-y-3"
            style={{ background: '#18181b', border: '1px solid #3f3f46' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-base">تعديل حساب — {editTarget.name}</h3>
            <div>
              <label className="label">اسم المقهى / الموقع</label>
              <input
                className="input-field"
                value={editCafeName}
                onChange={(e) => setEditCafeName(e.target.value)}
                style={{ textAlign: 'right' }}
              />
              <button disabled={editBusy} onClick={saveCafeName} className="btn-secondary w-full mt-2 text-sm">
                حفظ الاسم
              </button>
            </div>
            <div>
              <label className="label">البريد</label>
              <input
                className="input-field"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
              <button disabled={editBusy} onClick={saveEmail} className="btn-secondary w-full mt-2 text-sm">
                حفظ البريد
              </button>
            </div>
            <div>
              <label className="label">كلمة مرور جديدة</label>
              <input
                type="password"
                className="input-field"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                dir="ltr"
              />
              <button
                disabled={editBusy || editPassword.length < 6}
                onClick={savePassword}
                className="btn-secondary w-full mt-2 text-sm"
              >
                حفظ كلمة السر
              </button>
            </div>
            <button onClick={() => setEditTarget(null)} className="btn-secondary w-full">
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
