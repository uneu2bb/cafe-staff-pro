'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Employee = {
  id: string
  full_name: string
  employee_number: string
  salary_amount: number
  work_hours_per_day: number
  status: string
  job_title: string | null
  pin_code: string | null
  hire_date: string | null
  notes: string | null
}

type DayInfo = { status: string; check_in_at: string | null; check_out_at: string | null; worked_minutes: number | null }

/** جلسة مؤقت محلية قبل الحفظ */
type Session = {
  startMs: number
  endMs: number | null
  running: boolean
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('ar-SY', { weekday: 'short', day: 'numeric', month: 'short' })
}
function minsLabel(m: number | null | undefined) {
  if (m == null || m === 0) return '—'
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function statusMeta(s: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    none: { label: 'لم يسجل', color: '#a1a1aa', bg: 'rgba(113,113,122,0.15)' },
    present: { label: 'يعمل الآن', color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)' },
    late: { label: 'يعمل الآن', color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)' },
    checked_out: { label: 'محفوظ', color: '#93c5fd', bg: 'rgba(59,130,246,0.15)' },
    stopped: { label: 'متوقف', color: '#fcd34d', bg: 'rgba(245,158,11,0.15)' },
    incomplete: { label: 'غير مكتمل', color: '#fdba74', bg: 'rgba(249,115,22,0.15)' },
  }
  return map[s] || map.none
}

export default function HomeBoard({ adminName, adminRole }: { adminName: string; adminRole: string }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayMap, setTodayMap] = useState<Record<string, DayInfo>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [fullReport, setFullReport] = useState<any | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', salary_amount: '', work_hours_per_day: '8', job_title: '', pin_code: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const logoClicks = useRef({ n: 0, t: 0 })
  const [showPanelGate, setShowPanelGate] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelPwd, setPanelPwd] = useState('')
  const [panelTab, setPanelTab] = useState<'account' | 'rates' | 'withdrawals' | 'employees'>('employees')
  const [panelBusy, setPanelBusy] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newAccPwd, setNewAccPwd] = useState('')
  const [newPanelPwd, setNewPanelPwd] = useState('')
  const [rateSyp, setRateSyp] = useState('15000')
  const [rateTry, setRateTry] = useState('34')
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [wTotals, setWTotals] = useState({ USD: 0, SYP: 0, TRY: 0, total_usd: 0 })
  const [wForm, setWForm] = useState({ employee_id: '', amount: '', currency: 'USD', note: '' })
  const [form, setForm] = useState({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000' })
  const [saving, setSaving] = useState(false)

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 2500) }

  // ساعة تعمل كل ثانية طالما فيه جلسة شغالة
  useEffect(() => {
    const hasRunning = Object.values(sessions).some((s) => s.running)
    if (!hasRunning) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [sessions])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل')
      setEmployees(data.employees || [])
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data: days } = await supabase.from('daily_attendance').select('employee_id, status, check_in_at, check_out_at, worked_minutes').eq('work_date', today)
      const map: Record<string, DayInfo> = {}
      for (const d of days || []) {
        let status = d.status || 'none'
        if (d.check_in_at && d.check_out_at) status = 'checked_out'
        else if (d.check_in_at) status = 'present'
        map[d.employee_id] = { status, check_in_at: d.check_in_at, check_out_at: d.check_out_at, worked_minutes: d.worked_minutes }
      }
      setTodayMap(map)
    } catch (e: unknown) { showToast(false, e instanceof Error ? e.message : 'خطأ') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startSession = (empId: string) => {
    const day = todayMap[empId]
    if (day?.check_in_at && day?.check_out_at) {
      showToast(false, 'تم حفظ دوام هذا الموظف اليوم')
      return
    }
    if (sessions[empId]?.running) return
    setSessions((prev) => ({
      ...prev,
      [empId]: { startMs: Date.now(), endMs: null, running: true },
    }))
    showToast(true, 'بدأت الساعة')
  }

  const stopSession = (empId: string) => {
    const s = sessions[empId]
    if (!s?.running) {
      showToast(false, 'اضغط حضور أولاً')
      return
    }
    setSessions((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], endMs: Date.now(), running: false },
    }))
    showToast(true, 'توقفت الساعة — اضغط حفظ')
  }

  const saveSession = async (empId: string) => {
    const s = sessions[empId]
    if (!s) {
      showToast(false, 'لا توجد جلسة لحفظها')
      return
    }
    if (s.running || !s.endMs) {
      showToast(false, 'اضغط انصراف أولاً لإيقاف الساعة')
      return
    }
    if (busyId) return
    setBusyId(empId)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          action: 'save_session',
          check_in_at: new Date(s.startMs).toISOString(),
          check_out_at: new Date(s.endMs).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشل الحفظ')
      } else {
        showToast(true, data.message || 'تم الحفظ')
        setSessions((prev) => {
          const n = { ...prev }
          delete n[empId]
          return n
        })
        setTodayMap((prev) => ({
          ...prev,
          [empId]: {
            status: 'checked_out',
            check_in_at: data.check_in_at,
            check_out_at: data.check_out_at,
            worked_minutes: data.worked_minutes,
          },
        }))
      }
    } catch {
      showToast(false, 'خطأ اتصال')
    }
    setBusyId(null)
  }

  const getElapsedLabel = (empId: string) => {
    const s = sessions[empId]
    if (!s) return null
    // force re-read tick
    void tick
    const end = s.running ? Date.now() : (s.endMs || Date.now())
    return formatElapsed(end - s.startMs)
  }

  const generateReport = async (empId: string, month = reportMonth) => {
    setReportLoading(true); setFullReport(null)
    try {
      const res = await fetch(`/api/employees/report?employee_id=${empId}&month=${month}`)
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل التقرير')
      else setFullReport(data)
    } catch { showToast(false, 'خطأ اتصال') }
    setReportLoading(false)
  }

  const openEdit = (emp: Employee) => {
    setEditEmp(emp)
    setEditForm({ full_name: emp.full_name, salary_amount: String(emp.salary_amount || 0), work_hours_per_day: String(emp.work_hours_per_day || 8), job_title: emp.job_title || '', pin_code: emp.pin_code || '', notes: emp.notes || '' })
  }

  const saveEdit = async () => {
    if (!editEmp) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/employees/${editEmp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: editForm.full_name, salary_amount: Number(editForm.salary_amount) || 0, work_hours_per_day: Number(editForm.work_hours_per_day) || 8, job_title: editForm.job_title || null, pin_code: editForm.pin_code || null, notes: editForm.notes || null }) })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم حفظ التعديلات'); setEditEmp(null); load() }
    } catch { showToast(false, 'خطأ اتصال') }
    setEditSaving(false)
  }

  const deleteEmployee = async (emp: Employee) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف «${emp.full_name}»؟`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل الحذف')
      else { showToast(true, 'تم حذف الموظف'); setEditEmp(null); load() }
    } catch { showToast(false, 'خطأ اتصال') }
  }

  const onLogoClick = () => {
    const now = Date.now()
    if (now - logoClicks.current.t > 2000) logoClicks.current = { n: 0, t: now }
    logoClicks.current.n += 1; logoClicks.current.t = now
    if (logoClicks.current.n >= 5) { logoClicks.current.n = 0; setShowPanelGate(true); setPanelPwd('') }
  }

  const loadWithdrawals = async () => {
    try {
      const res = await fetch('/api/withdrawals')
      const data = await res.json()
      if (data.need_migration) return
      setWithdrawals(data.withdrawals || [])
      if (data.totals) setWTotals(data.totals)
    } catch {}
  }

  const verifyPanel = async () => {
    setPanelBusy(true)
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify_panel', password: panelPwd }) })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else {
        setShowPanelGate(false); setPanelOpen(true)
        const s = await fetch('/api/admin/settings').then((r) => r.json())
        setNewEmail(s.email || ''); setRateSyp(s.rate_syp_per_usd || '15000'); setRateTry(s.rate_try_per_usd || '34')
        loadWithdrawals()
      }
    } catch { showToast(false, 'خطأ اتصال') }
    setPanelBusy(false)
  }

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active')
    let working = 0, saved = 0, none = 0
    for (const e of active) {
      const sess = sessions[e.id]
      const day = todayMap[e.id]
      if (sess?.running) working++
      else if (sess && !sess.running) working++ // متوقف بانتظار الحفظ
      else if (day?.check_in_at && day?.check_out_at) saved++
      else none++
    }
    return { total: active.length, working, saved, none }
  }, [employees, todayMap, sessions])

  const filtered = useMemo(() => {
    const q = search.trim()
    const list = employees.filter((e) => e.status === 'active')
    if (!q) return list
    return list.filter((e) => e.full_name.includes(q) || e.employee_number.includes(q))
  }, [employees, search])

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, salary_amount: Number(form.salary_amount) || 0, work_hours_per_day: Number(form.work_hours_per_day) || 8 }) })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم الإضافة'); setShowAdd(false); setForm({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000' }); load() }
    } catch { showToast(false, 'خطأ') }
    setSaving(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0f0c 0%, #0a0a0a 40%, #12100a 100%)' }}>
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium" style={{ background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(220,38,38,0.95)', color: '#fff' }}>{toast.msg}</div>}

      <header className="sticky top-0 z-20 border-b border-zinc-800/80" style={{ background: 'rgba(10,12,11,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onLogoClick} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #059669, #d97706)', border: 'none', cursor: 'pointer' }}><span className="text-lg">☕</span></button>
            <div><h1 className="font-bold text-white text-base">Cafe Staff Pro</h1><p className="text-xs text-zinc-500">{adminName} · {adminRole === 'owner' ? 'المالك' : 'مدير'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2">+ موظف</button>
            <button onClick={async () => { await createClient().auth.signOut(); router.push('/login') }} className="text-sm text-red-400 px-3 py-2">خروج</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[ { label: 'الموظفون', value: stats.total, c: '#6ee7b7' }, { label: 'يعملون الآن', value: stats.working, c: '#34d399' }, { label: 'محفوظ اليوم', value: stats.saved, c: '#60a5fa' }, { label: 'لم يبدأوا', value: stats.none, c: '#a1a1aa' } ].map((s) => (
            <div key={s.label} className="card glass" style={{ padding: '14px 16px' }}><p className="text-xs text-zinc-500">{s.label}</p><p className="text-2xl font-bold mt-1" style={{ color: s.c }}>{s.value}</p></div>
          ))}
        </div>
        <div className="flex gap-3">
          <input className="input-field" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ textAlign: 'right' }} />
          <button onClick={() => { setLoading(true); load() }} className="btn-secondary shrink-0">تحديث</button>
        </div>
        {loading ? <div className="text-center py-16 text-zinc-500">...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((emp) => {
              const day = todayMap[emp.id]
              const sess = sessions[emp.id]
              const elapsed = getElapsedLabel(emp.id)
              let badge = 'none'
              if (day?.check_in_at && day?.check_out_at && !sess) badge = 'checked_out'
              else if (sess?.running) badge = 'present'
              else if (sess && !sess.running) badge = 'stopped'
              const st = statusMeta(badge)
              return (
                <div key={emp.id} className="card glass employee-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-right flex-1">
                      <h3 className="font-bold text-white text-lg">{emp.full_name}</h3>
                      <p className="text-xs text-zinc-500">#{emp.employee_number} · <span className="text-amber-400">${Number(emp.salary_amount || 0).toFixed(0)}</span></p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>

                  {/* الساعة */}
                  <div className="mb-3 rounded-xl px-3 py-2.5 text-center" style={{ background: sess?.running ? 'rgba(16,185,129,0.12)' : sess ? 'rgba(245,158,11,0.12)' : 'rgba(39,39,42,0.6)', border: `1px solid ${sess?.running ? 'rgba(16,185,129,0.35)' : sess ? 'rgba(245,158,11,0.35)' : '#3f3f46'}` }}>
                    <p className="text-[10px] text-zinc-500 mb-0.5">{sess?.running ? 'يعمل الآن' : sess ? 'متوقف — جاهز للحفظ' : day?.worked_minutes ? 'ساعات محفوظة' : 'الساعة'}</p>
                    <p className="text-2xl font-bold tracking-wider" dir="ltr" style={{ color: sess?.running ? '#6ee7b7' : sess ? '#fcd34d' : '#a1a1aa', fontVariantNumeric: 'tabular-nums' }}>
                      {elapsed || (day?.worked_minutes != null ? minsLabel(day.worked_minutes) : '00:00:00')}
                    </p>
                    {(sess || day?.check_in_at) && (
                      <p className="text-[11px] text-zinc-500 mt-1" dir="ltr">
                        {fmtTime(sess ? new Date(sess.startMs).toISOString() : day?.check_in_at || null)}
                        {' → '}
                        {sess?.endMs ? fmtTime(new Date(sess.endMs).toISOString()) : day?.check_out_at ? fmtTime(day.check_out_at) : '...'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button disabled={!!busyId || !!sess?.running || !!(day?.check_in_at && day?.check_out_at)} onClick={() => startSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#059669', opacity: sess?.running || (day?.check_in_at && day?.check_out_at) ? 0.5 : 1 }}>حضور</button>
                    <button disabled={!!busyId || !sess?.running} onClick={() => stopSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#dc2626', opacity: !sess?.running ? 0.5 : 1 }}>انصراف</button>
                    <button disabled={!!busyId || !sess || sess.running} onClick={() => saveSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#2563eb', opacity: !sess || sess.running ? 0.5 : 1 }}>{busyId === emp.id ? '...' : 'حفظ'}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openEdit(emp)} className="py-2 rounded-xl text-xs font-medium" style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}>تعديل</button>
                    <button onClick={() => generateReport(emp.id)} className="py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(5,150,105,0.2)', color: '#6ee7b7', border: '1px solid rgba(5,150,105,0.4)' }}>توليد تقرير</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">إضافة موظف</h2>
            <form onSubmit={addEmployee} className="space-y-3">
              <div><label className="label">الاسم *</label><input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الرقم *</label><input className="input-field" required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} dir="ltr" /></div>
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} dir="ltr" /></div>
              </div>
              <div className="flex gap-2"><button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? '...' : 'حفظ'}</button><button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">إلغاء</button></div>
            </form>
          </div>
        </div>
      )}

      {editEmp && (
        <div className="modal-backdrop" onClick={() => setEditEmp(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-1">تعديل موظف</h2>
            <p className="text-xs text-zinc-500 mb-4">#{editEmp.employee_number}</p>
            <div className="space-y-3">
              <div><label className="label">الاسم</label><input className="input-field" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={editForm.salary_amount} onChange={(e) => setEditForm({ ...editForm, salary_amount: e.target.value })} dir="ltr" /></div>
                <div><label className="label">ساعات/يوم</label><input className="input-field" type="number" value={editForm.work_hours_per_day} onChange={(e) => setEditForm({ ...editForm, work_hours_per_day: e.target.value })} dir="ltr" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving} className="btn-primary flex-1">{editSaving ? '...' : 'حفظ'}</button>
                <button onClick={() => setEditEmp(null)} className="btn-secondary">إلغاء</button>
              </div>
              <button onClick={() => deleteEmployee(editEmp)} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.35)' }}>حذف الموظف</button>
            </div>
          </div>
        </div>
      )}

      {(fullReport || reportLoading) && (
        <div className="modal-backdrop" onClick={() => setFullReport(null)}>
          <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            {reportLoading ? <p className="text-center text-zinc-500 py-10">جاري توليد التقرير...</p> : fullReport && (
              <>
                <h2 className="text-lg font-bold text-white">{fullReport.employee.full_name}</h2>
                <p className="text-xs text-zinc-500 mb-3">#{fullReport.employee.employee_number} · {fullReport.month}</p>
                <input type="month" className="input-field mb-3" value={reportMonth} dir="ltr" onChange={(e) => { setReportMonth(e.target.value); generateReport(fullReport.employee.id, e.target.value) }} />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">أيام الدوام</p><p className="text-xl font-bold text-emerald-400">{fullReport.stats.presentDays}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">ساعات العمل</p><p className="text-xl font-bold text-amber-400">{fullReport.stats.totalHours.toFixed(2)}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">يطلعله باليوم</p><p className="text-xl font-bold text-sky-400">${Number(fullReport.stats.dayRate).toFixed(2)}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">الصافي</p><p className="text-xl font-bold text-emerald-400">${Number(fullReport.stats.net).toFixed(2)}</p></div>
                </div>
                <div className="card mb-3" style={{ padding: 14 }}>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-400">الراتب الثابت</span><span className="text-white">${Number(fullReport.stats.monthlySalary).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">السحوبات</span><span className="text-red-400">− ${Number(fullReport.stats.withdrawnUsd).toFixed(2)}</span></div>
                    <div className="border-t border-zinc-700 my-2" />
                    <div className="flex justify-between"><span className="text-white font-bold">الصافي</span><span className="text-emerald-400 font-bold text-lg">${Number(fullReport.stats.net).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 mb-3">
                  {(fullReport.days || []).map((r: any) => (
                    <div key={r.work_date} className="flex gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: '#09090b' }}>
                      <span className="text-zinc-300 w-16">{fmtDate(r.work_date)}</span>
                      <span className="text-emerald-400" dir="ltr">{fmtTime(r.check_in_at)}</span>
                      <span className="text-red-400" dir="ltr">{fmtTime(r.check_out_at)}</span>
                      <span className="text-zinc-400 mr-auto" dir="ltr">{minsLabel(r.net_worked_minutes ?? r.worked_minutes)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFullReport(null)} className="btn-secondary w-full">إغلاق</button>
              </>
            )}
          </div>
        </div>
      )}

      {showPanelGate && (
        <div className="modal-backdrop" onClick={() => setShowPanelGate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">لوحة التحكم</h2>
            <p className="text-xs text-zinc-500 mb-3">كلمة المرور (افتراضي: 0000)</p>
            <input type="password" className="input-field mb-3" value={panelPwd} onChange={(e) => setPanelPwd(e.target.value)} dir="ltr" />
            <button disabled={panelBusy} onClick={verifyPanel} className="btn-primary w-full">{panelBusy ? '...' : 'دخول'}</button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div className="modal-backdrop" onClick={() => setPanelOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-3">لوحة التحكم</h2>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([['employees', 'الموظفون'], ['withdrawals', 'السحوبات'], ['rates', 'الصرف'], ['account', 'الحساب']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id)} className="px-2.5 py-1.5 rounded-xl text-xs" style={{ background: panelTab === id ? 'rgba(5,150,105,0.25)' : '#27272a', color: panelTab === id ? '#6ee7b7' : '#a1a1aa', border: 'none' }}>{label}</button>
              ))}
            </div>
            {panelTab === 'employees' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {employees.filter((e) => e.status === 'active').map((emp) => (
                  <div key={emp.id} className="card flex items-center justify-between gap-2" style={{ padding: 12 }}>
                    <div><p className="text-sm text-white font-medium">{emp.full_name}</p><p className="text-xs text-zinc-500">#{emp.employee_number}</p></div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <button onClick={() => openEdit(emp)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}>تعديل</button>
                      <button onClick={() => deleteEmployee(emp)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.35)' }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {panelTab === 'withdrawals' && (
              <div className="space-y-3">
                <select className="input-field" value={wForm.employee_id} onChange={(e) => setWForm({ ...wForm, employee_id: e.target.value })} style={{ textAlign: 'right' }}>
                  <option value="">اختر موظف</option>
                  {employees.filter((e) => e.status === 'active').map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-field" type="number" placeholder="المبلغ" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} dir="ltr" />
                  <select className="input-field" value={wForm.currency} onChange={(e) => setWForm({ ...wForm, currency: e.target.value })}>
                    <option value="USD">USD</option><option value="SYP">SYP</option><option value="TRY">TRY</option>
                  </select>
                </div>
                <button className="btn-primary w-full text-sm" disabled={panelBusy} onClick={async () => {
                  setPanelBusy(true)
                  const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wForm) })
                  const d = await res.json()
                  if (!res.ok) showToast(false, d.error || 'فشل')
                  else { showToast(true, 'تم'); setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' }); loadWithdrawals() }
                  setPanelBusy(false)
                }}>تسجيل سحب</button>
              </div>
            )}
            {panelTab === 'rates' && (
              <div className="space-y-3">
                <div><label className="label">SYP لكل 1 USD</label><input className="input-field" type="number" value={rateSyp} onChange={(e) => setRateSyp(e.target.value)} dir="ltr" /></div>
                <div><label className="label">TRY لكل 1 USD</label><input className="input-field" type="number" value={rateTry} onChange={(e) => setRateTry(e.target.value)} dir="ltr" /></div>
                <button className="btn-primary w-full" onClick={async () => {
                  const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_rates', rate_syp_per_usd: rateSyp, rate_try_per_usd: rateTry }) })
                  showToast(res.ok, res.ok ? 'تم' : 'فشل')
                }}>حفظ</button>
              </div>
            )}
            {panelTab === 'account' && (
              <div className="space-y-3">
                <div><label className="label">البريد</label><input className="input-field" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_email', email: newEmail }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ البريد</button></div>
                <div><label className="label">كلمة مرور اللوحة</label><input type="password" className="input-field" value={newPanelPwd} onChange={(e) => setNewPanelPwd(e.target.value)} dir="ltr" />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_panel_password', password: newPanelPwd }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ</button></div>
              </div>
            )}
            <button onClick={() => setPanelOpen(false)} className="btn-secondary w-full mt-4">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
