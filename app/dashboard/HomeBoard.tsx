'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Employee = {
  id: string
  full_name: string
  employee_number: string
  salary_amount: number
  salary_type: string
  hire_date: string | null
  work_hours_per_day: number
  status: string
  job_title: string | null
  phone: string | null
  notes: string | null
  pin_code: string | null
}

type DayInfo = {
  status: string
  check_in_at: string | null
  check_out_at: string | null
  worked_minutes: number | null
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function statusMeta(s: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    none: { label: 'لم يسجل', color: '#a1a1aa', bg: 'rgba(113,113,122,0.15)' },
    present: { label: 'حاضر', color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)' },
    late: { label: 'متأخر', color: '#fcd34d', bg: 'rgba(245,158,11,0.15)' },
    absent: { label: 'غائب', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)' },
    checked_out: { label: 'منصرف', color: '#93c5fd', bg: 'rgba(59,130,246,0.15)' },
    incomplete: { label: 'غير مكتمل', color: '#fdba74', bg: 'rgba(249,115,22,0.15)' },
    on_leave: { label: 'إجازة', color: '#c4b5fd', bg: 'rgba(139,92,246,0.15)' },
  }
  return map[s] || map.none
}

export default function HomeBoard({ adminName, adminRole }: { adminName: string; adminRole: string }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayMap, setTodayMap] = useState<Record<string, DayInfo>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    employee_number: '',
    salary_amount: '',
    hire_date: '',
    work_hours_per_day: '8',
    job_title: '',
    phone: '',
    notes: '',
    pin_code: '0000',
  })
  const [saving, setSaving] = useState(false)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل التحميل')
      setEmployees(data.employees || [])

      // حالة اليوم من supabase مباشرة
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data: days } = await supabase
        .from('daily_attendance')
        .select('employee_id, status, check_in_at, check_out_at, worked_minutes')
        .eq('work_date', today)

      const map: Record<string, DayInfo> = {}
      for (const d of days || []) {
        let status = d.status || 'none'
        if (d.check_in_at && d.check_out_at) status = 'checked_out'
        else if (d.check_in_at && !d.check_out_at) status = d.status === 'late' ? 'late' : 'present'
        map[d.employee_id] = {
          status,
          check_in_at: d.check_in_at,
          check_out_at: d.check_out_at,
          worked_minutes: d.worked_minutes,
        }
      }
      setTodayMap(map)
    } catch (e: unknown) {
      showToast(false, e instanceof Error ? e.message : 'خطأ')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active')
    let present = 0, absent = 0, out = 0, none = 0
    for (const e of active) {
      const s = todayMap[e.id]?.status || 'none'
      if (s === 'present' || s === 'late') present++
      else if (s === 'absent') absent++
      else if (s === 'checked_out') out++
      else none++
    }
    return { total: active.length, present, absent, out, none }
  }, [employees, todayMap])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return employees.filter((e) => e.status === 'active')
    return employees.filter(
      (e) =>
        e.status === 'active' &&
        (e.full_name.includes(q) || e.employee_number.includes(q))
    )
  }, [employees, search])

  const doAction = async (employeeId: string, action: 'check_in' | 'check_out' | 'absent') => {
    setBusyId(employeeId)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, action }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشلت العملية')
      } else {
        showToast(true, data.message || 'تم')
        await load()
      }
    } catch {
      showToast(false, 'خطأ في الاتصال')
    }
    setBusyId(null)
  }

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salary_amount: Number(form.salary_amount) || 0,
          work_hours_per_day: Number(form.work_hours_per_day) || 8,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, data.error || 'فشل الإضافة')
      } else {
        showToast(true, 'تم إضافة الموظف')
        setShowAdd(false)
        setForm({
          full_name: '',
          employee_number: '',
          salary_amount: '',
          hire_date: '',
          work_hours_per_day: '8',
          job_title: '',
          phone: '',
          notes: '',
          pin_code: '0000',
        })
        await load()
      }
    } catch {
      showToast(false, 'خطأ في الاتصال')
    }
    setSaving(false)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0f0c 0%, #0a0a0a 40%, #12100a 100%)' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl"
          style={{
            background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(220,38,38,0.95)',
            color: '#fff',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-800/80" style={{ background: 'rgba(10,12,11,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #059669, #d97706)' }}>
              <span className="text-lg">☕</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-base">Cafe Staff Pro</h1>
              <p className="text-xs text-zinc-500">{adminName} · {adminRole === 'owner' ? 'المالك' : 'مدير'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2">+ موظف</button>
            <Link href="/kiosk" className="btn-secondary text-sm" style={{ textDecoration: 'none' }}>شاشة الحضور</Link>
            <button onClick={logout} className="text-sm text-red-400 px-3 py-2 rounded-xl hover:bg-red-500/10">خروج</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'الموظفون', value: stats.total, c: '#6ee7b7' },
            { label: 'حاضرون', value: stats.present, c: '#34d399' },
            { label: 'منصرفون', value: stats.out, c: '#60a5fa' },
            { label: 'غائبون', value: stats.absent, c: '#f87171' },
            { label: 'لم يسجلوا', value: stats.none, c: '#a1a1aa' },
          ].map((s) => (
            <div key={s.label} className="card glass" style={{ padding: '14px 16px' }}>
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.c }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <input
            className="input-field"
            placeholder="بحث بالاسم أو الرقم الوظيفي..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ textAlign: 'right' }}
          />
          <button onClick={load} className="btn-secondary shrink-0">تحديث</button>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="text-center py-20 text-zinc-500">جاري التحميل...</div>
        ) : !filtered.length ? (
          <div className="card text-center py-16">
            <p className="text-zinc-400 mb-4">لا يوجد موظفون بعد</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary">إضافة أول موظف</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((emp) => {
              const day = todayMap[emp.id]
              const st = statusMeta(day?.status || 'none')
              const busy = busyId === emp.id
              return (
                <div key={emp.id} className="card glass employee-card">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <button
                      onClick={() => setSelected(emp)}
                      className="text-right flex-1"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <h3 className="font-bold text-white text-lg leading-tight">{emp.full_name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        #{emp.employee_number}
                        {emp.job_title ? ` · ${emp.job_title}` : ''}
                      </p>
                    </button>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}33` }}
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mb-4">
                    <div>
                      <span className="text-zinc-600">الراتب: </span>
                      <span className="text-amber-400 font-medium">${Number(emp.salary_amount || 0).toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">دخول: </span>
                      <span className="text-emerald-400 font-mono" dir="ltr">{fmtTime(day?.check_in_at || null)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">ساعات/يوم: </span>
                      {emp.work_hours_per_day || 8}
                    </div>
                    <div>
                      <span className="text-zinc-600">خروج: </span>
                      <span className="text-red-400 font-mono" dir="ltr">{fmtTime(day?.check_out_at || null)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => doAction(emp.id, 'check_in')}
                      className="py-2.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#059669' }}
                    >
                      حضور
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => doAction(emp.id, 'absent')}
                      className="py-2.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#b45309' }}
                    >
                      غياب
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => doAction(emp.id, 'check_out')}
                      className="py-2.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#dc2626' }}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Add employee modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">إضافة موظف</h2>
            <form onSubmit={addEmployee} className="space-y-3">
              <div>
                <label className="label">الاسم الكامل *</label>
                <input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ textAlign: 'right' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الرقم الوظيفي *</label>
                  <input className="input-field" required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} dir="ltr" />
                </div>
                <div>
                  <label className="label">الراتب الشهري $</label>
                  <input className="input-field" type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">تاريخ البدء</label>
                  <input className="input-field" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} dir="ltr" />
                </div>
                <div>
                  <label className="label">ساعات العمل اليومية</label>
                  <input className="input-field" type="number" value={form.work_hours_per_day} onChange={(e) => setForm({ ...form, work_hours_per_day: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">المسمى الوظيفي</label>
                  <input className="input-field" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} style={{ textAlign: 'right' }} />
                </div>
                <div>
                  <label className="label">رمز PIN للحضور</label>
                  <input className="input-field" value={form.pin_code} onChange={(e) => setForm({ ...form, pin_code: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="label">ملاحظات</label>
                <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ textAlign: 'right' }} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee detail modal */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">{selected.full_name}</h2>
            <p className="text-sm text-zinc-500 mb-4">#{selected.employee_number} · ${Number(selected.salary_amount || 0).toFixed(0)} / شهر</p>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="card" style={{ padding: 12 }}>
                <p className="text-zinc-500 text-xs">ساعات يومية</p>
                <p className="text-white font-bold">{selected.work_hours_per_day || 8}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-zinc-500 text-xs">تاريخ البدء</p>
                <p className="text-white font-bold">{selected.hire_date || '—'}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-zinc-500 text-xs">المسمى</p>
                <p className="text-white font-bold">{selected.job_title || '—'}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-zinc-500 text-xs">PIN</p>
                <p className="text-white font-bold font-mono" dir="ltr">{selected.pin_code || '—'}</p>
              </div>
            </div>
            {selected.notes && <p className="text-sm text-zinc-400 mb-4">{selected.notes}</p>}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => { doAction(selected.id, 'check_in'); setSelected(null) }} className="py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#059669' }}>حضور</button>
              <button onClick={() => { doAction(selected.id, 'absent'); setSelected(null) }} className="py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#b45309' }}>غياب</button>
              <button onClick={() => { doAction(selected.id, 'check_out'); setSelected(null) }} className="py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#dc2626' }}>انصراف</button>
            </div>
            <button onClick={() => setSelected(null)} className="btn-secondary w-full">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
