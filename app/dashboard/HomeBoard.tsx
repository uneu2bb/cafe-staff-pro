'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReportModal from './ReportModal'
import TenantsTab from './TenantsTab'

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
type Session = { startMs: number; endMs: number | null; running: boolean }

const SESS_KEY = 'cafe_staff_sessions'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
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
    none: { label: 'لم يسجل', color: '#94a3b8', bg: 'rgba(100,116,139,0.18)' },
    present: { label: 'يعمل الآن', color: '#6ee7b7', bg: 'rgba(16,185,129,0.18)' },
    checked_out: { label: 'محفوظ', color: '#93c5fd', bg: 'rgba(59,130,246,0.18)' },
    stopped: { label: 'متوقف', color: '#fcd34d', bg: 'rgba(245,158,11,0.18)' },
  }
  return map[s] || map.none
}
function nowClock() {
  return new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function todayLabel() {
  return new Date().toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function HomeBoard({ adminName, adminRole, cafeName: cafeNameProp = 'Cafe Staff Pro' }: { adminName: string; adminRole: string; cafeName?: string }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayMap, setTodayMap] = useState<Record<string, DayInfo>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [sessionsReady, setSessionsReady] = useState(false)
  const [tick, setTick] = useState(0)
  const [clock, setClock] = useState(nowClock())
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
  const [panelTab, setPanelTab] = useState<'account' | 'rates' | 'withdrawals' | 'employees' | 'cafes'>('employees')
  const [panelBusy, setPanelBusy] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [cafeName, setCafeName] = useState(cafeNameProp)
  const [siteTitle, setSiteTitle] = useState(cafeNameProp)
  const [newPanelPwd, setNewPanelPwd] = useState('')
  const [newLoginPwd, setNewLoginPwd] = useState('')
  const [rateSyp, setRateSyp] = useState('15000')
  const [rateTry, setRateTry] = useState('34')
  const [wForm, setWForm] = useState({ employee_id: '', amount: '', currency: 'USD', note: '' })
  const [form, setForm] = useState({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000' })
  const [saving, setSaving] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 2500) }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        const today = new Date().toISOString().slice(0, 10)
        if (parsed.date === today && parsed.sessions) setSessions(parsed.sessions)
        else localStorage.removeItem(SESS_KEY)
      }
    } catch {}
    setSessionsReady(true)
  }, [])

  useEffect(() => {
    if (!sessionsReady) return
    try {
      if (Object.keys(sessions).length === 0) localStorage.removeItem(SESS_KEY)
      else localStorage.setItem(SESS_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), sessions }))
    } catch {}
  }, [sessions, sessionsReady])

  useEffect(() => {
    const hasRunning = Object.values(sessions).some((s) => s.running)
    const id = setInterval(() => {
      setTick((x) => x + 1)
      setClock(nowClock())
    }, 1000)
    const bump = () => setTick((x) => x + 1)
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', bump)
      window.removeEventListener('focus', bump)
    }
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
    if (day?.check_in_at && day?.check_out_at) { showToast(false, 'تم حفظ دوام هذا الموظف اليوم'); return }
    if (sessions[empId]?.running) return
    setSessions((prev) => ({ ...prev, [empId]: { startMs: Date.now(), endMs: null, running: true } }))
    showToast(true, 'بدأت الساعة — تبقى حتى لو أغلقت المتصفح')
  }

  const stopSession = (empId: string) => {
    const s = sessions[empId]
    if (!s?.running) { showToast(false, 'اضغط حضور أولاً'); return }
    setSessions((prev) => ({ ...prev, [empId]: { ...prev[empId], endMs: Date.now(), running: false } }))
    showToast(true, 'توقفت الساعة — اضغط حفظ')
  }

  const saveSession = async (empId: string) => {
    const s = sessions[empId]
    if (!s) { showToast(false, 'لا توجد جلسة'); return }
    if (s.running || !s.endMs) { showToast(false, 'اضغط انصراف أولاً'); return }
    if (busyId) return
    setBusyId(empId)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId, action: 'save_session', check_in_at: new Date(s.startMs).toISOString(), check_out_at: new Date(s.endMs).toISOString() }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) showToast(false, data.error || 'فشل الحفظ')
      else {
        showToast(true, data.message || 'تم الحفظ')
        setSessions((prev) => { const n = { ...prev }; delete n[empId]; return n })
        setTodayMap((prev) => ({ ...prev, [empId]: { status: 'checked_out', check_in_at: data.check_in_at, check_out_at: data.check_out_at, worked_minutes: data.worked_minutes } }))
      }
    } catch { showToast(false, 'خطأ اتصال') }
    setBusyId(null)
  }

  const getElapsedLabel = (empId: string) => {
    const s = sessions[empId]
    if (!s) return null
    void tick
    const end = s.running ? Date.now() : (s.endMs || Date.now())
    return formatElapsed(end - s.startMs)
  }

  const generateReport = async (empId: string, month = reportMonth) => {
    setReportLoading(true); setFullReport(null)
    try {
      const res = await fetch(`/api/employees/report?employee_id=${empId}&month=${month}`)
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
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
      else { showToast(true, 'تم'); setEditEmp(null); load() }
    } catch { showToast(false, 'خطأ') }
    setEditSaving(false)
  }

  const deleteEmployee = async (emp: Employee) => {
    if (!confirm(`حذف «${emp.full_name}»؟`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم الحذف'); setEditEmp(null); load() }
    } catch { showToast(false, 'خطأ') }
  }

  const onLogoClick = () => {
    const now = Date.now()
    if (now - logoClicks.current.t > 2000) logoClicks.current = { n: 0, t: now }
    logoClicks.current.n += 1; logoClicks.current.t = now
    if (logoClicks.current.n >= 5) { logoClicks.current.n = 0; setShowPanelGate(true); setPanelPwd('') }
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
        setNewEmail(s.email || ''); setCafeName(s.cafe_name || ''); setRateSyp(s.rate_syp_per_usd || '15000'); setRateTry(s.rate_try_per_usd || '34')
        try {
          const sa = await fetch('/api/super-admin/tenants')
          setIsSuperAdmin(sa.ok)
        } catch { setIsSuperAdmin(false) }
      }
    } catch { showToast(false, 'خطأ') }
    setPanelBusy(false)
  }

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active')
    let working = 0, saved = 0, none = 0
    for (const e of active) {
      const sess = sessions[e.id]
      const day = todayMap[e.id]
      if (sess?.running) working++
      else if (sess) working++
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
      else { showToast(true, 'تم'); setShowAdd(false); setForm({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000' }); load() }
    } catch { showToast(false, 'خطأ') }
    setSaving(false)
  }

  const roleLabel = adminRole === 'owner' ? 'المالك' : adminRole === 'manager' ? 'مدير' : adminRole

  return (
    <div className="min-h-screen" style={{ background: '#0b1220' }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-medium shadow-xl" style={{ background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(220,38,38,0.95)', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-l" style={{ background: 'linear-gradient(180deg,#0a1628,#0b1220)', borderColor: 'rgba(51,65,85,0.55)' }}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(51,65,85,0.45)' }}>
            <button type="button" onClick={onLogoClick} className="flex items-center gap-3 w-full text-right" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 8px 20px rgba(14,165,233,0.35)' }}>
                <span className="text-lg">☕</span>
              </div>
              <div className="text-right flex-1">
                <p className="text-white font-bold text-sm leading-tight">{siteTitle}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">نظام الحضور</p>
              </div>
            </button>
          </div>
          <nav className="p-3 space-y-1 flex-1">
            <div className="side-nav-item active">🏠 الرئيسية</div>
            <button type="button" className="side-nav-item" onClick={() => setShowAdd(true)}>➕ إضافة موظف</button>
            <button type="button" className="side-nav-item" onClick={() => { setShowPanelGate(true); setPanelPwd('') }}>⚙️ لوحة التحكم</button>
            <button type="button" className="side-nav-item" onClick={() => { setLoading(true); load() }}>🔄 تحديث</button>
          </nav>
          <div className="p-4 border-t" style={{ borderColor: 'rgba(51,65,85,0.45)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#0369a1,#4f46e5)', color: '#fff' }}>
                {(adminName || 'م').charAt(0)}
              </div>
              <div className="text-right flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{adminName}</p>
                <p className="text-[11px] text-slate-500">{roleLabel}</p>
              </div>
            </div>
            <button onClick={async () => { await createClient().auth.signOut(); router.push('/login') }} className="side-nav-item" style={{ color: '#f87171' }}>خروج</button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Top bar mobile */}
          <header className="sticky top-0 z-20 border-b md:hidden" style={{ background: 'rgba(11,18,32,0.9)', backdropFilter: 'blur(14px)', borderColor: 'rgba(51,65,85,0.5)' }}>
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <button type="button" onClick={onLogoClick} className="flex items-center gap-2" style={{ background: 'none', border: 'none' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}><span>☕</span></div>
                <div className="text-right">
                  <p className="text-white font-bold text-sm">{siteTitle}</p>
                  <p className="text-[10px] text-slate-500">{adminName}</p>
                </div>
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2">+ موظف</button>
                <button onClick={() => setMobileNav(!mobileNav)} className="btn-secondary text-xs px-3 py-2">☰</button>
              </div>
            </div>
            {mobileNav && (
              <div className="px-4 pb-3 space-y-1 border-t" style={{ borderColor: 'rgba(51,65,85,0.4)' }}>
                <button className="side-nav-item" onClick={() => { setShowPanelGate(true); setMobileNav(false) }}>لوحة التحكم</button>
                <button className="side-nav-item" onClick={async () => { await createClient().auth.signOut(); router.push('/login') }} style={{ color: '#f87171' }}>خروج</button>
              </div>
            )}
          </header>

          <main className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
            {/* Hero */}
            <section
              className="relative overflow-hidden rounded-2xl border fade-up"
              style={{
                borderColor: 'rgba(56,189,248,0.15)',
                background:
                  'linear-gradient(120deg, rgba(14,165,233,0.18), rgba(99,102,241,0.12) 40%, rgba(15,23,42,0.9)), radial-gradient(circle at 20% 20%, rgba(56,189,248,0.2), transparent 50%)',
              }}
            >
              <div className="relative z-10 p-5 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-right">
                  <p className="text-sky-300/90 text-sm mb-1">مرحباً بك في لوحة التحكم</p>
                  <h2 className="text-xl md:text-2xl font-bold text-white">إدارة موظفيك بكل سهولة واحترافية</h2>
                  <p className="text-slate-400 text-sm mt-2">{siteTitle} · {roleLabel}</p>
                </div>
                <div className="rounded-2xl px-5 py-3 text-center shrink-0" style={{ background: 'rgba(2,6,23,0.55)', border: '1px solid rgba(71,85,105,0.5)' }}>
                  <p className="text-[11px] text-slate-400 mb-1">{todayLabel()}</p>
                  <p className="text-2xl font-bold tracking-wider text-white" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{clock}</p>
                  <p className="text-[11px] text-sky-300/80 mt-1">الوقت الحالي</p>
                </div>
              </div>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 fade-up" style={{ animationDelay: '0.05s' }}>
              {[
                { label: 'إجمالي الموظفين', value: stats.total, icon: '👥', from: '#f59e0b', to: '#d97706' },
                { label: 'يعملون الآن', value: stats.working, icon: '⏱', from: '#10b981', to: '#059669' },
                { label: 'محفوظ اليوم', value: stats.saved, icon: '✓', from: '#3b82f6', to: '#2563eb' },
                { label: 'لم يبدأوا', value: stats.none, icon: '○', from: '#64748b', to: '#475569' },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{s.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `linear-gradient(135deg,${s.from},${s.to})`, boxShadow: `0 8px 18px ${s.from}33` }}>
                      {s.icon}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Search + actions */}
            <section className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input className="input-field flex-1" placeholder="بحث عن موظف..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ textAlign: 'right' }} />
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2.5 whitespace-nowrap">+ موظف جديد</button>
                <button onClick={() => { setLoading(true); load() }} className="btn-secondary text-sm px-4 py-2.5">تحديث</button>
              </div>
            </section>

            {/* Employees */}
            {loading ? (
              <div className="text-center py-16 text-slate-500">جاري التحميل...</div>
            ) : (
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-bold text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                            {emp.full_name.charAt(0)}
                          </div>
                          <div className="text-right min-w-0">
                            <h3 className="font-bold text-white text-base truncate">{emp.full_name}</h3>
                            <p className="text-xs text-slate-500">#{emp.employee_number} · <span className="text-amber-300/90">${Number(emp.salary_amount || 0).toFixed(0)}</span></p>
                          </div>
                        </div>
                        <span className="text-[11px] px-2.5 py-1 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>

                      <div className="mb-3 rounded-xl px-3 py-3 text-center" style={{ background: sess?.running ? 'rgba(16,185,129,0.1)' : sess ? 'rgba(245,158,11,0.1)' : 'rgba(15,23,42,0.7)', border: `1px solid ${sess?.running ? 'rgba(16,185,129,0.35)' : sess ? 'rgba(245,158,11,0.35)' : 'rgba(51,65,85,0.6)'}` }}>
                        <p className="text-[10px] text-slate-500 mb-0.5">{sess?.running ? 'يعمل الآن' : sess ? 'متوقف — جاهز للحفظ' : day?.worked_minutes ? 'ساعات محفوظة' : 'الساعة'}</p>
                        <p className="text-2xl font-bold tracking-wider" dir="ltr" style={{ color: sess?.running ? '#6ee7b7' : sess ? '#fcd34d' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                          {elapsed || (day?.worked_minutes != null ? `${Math.floor(day.worked_minutes / 60)}:${String(day.worked_minutes % 60).padStart(2, '0')}` : '00:00:00')}
                        </p>
                        {(sess || day?.check_in_at) && (
                          <p className="text-[11px] text-slate-500 mt-1" dir="ltr">
                            {fmtTime(sess ? new Date(sess.startMs).toISOString() : day?.check_in_at || null)}
                            {' → '}
                            {sess?.endMs ? fmtTime(new Date(sess.endMs).toISOString()) : day?.check_out_at ? fmtTime(day.check_out_at) : '...'}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <button disabled={!!busyId || !!sess?.running || !!(day?.check_in_at && day?.check_out_at)} onClick={() => startSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#059669,#10b981)', opacity: sess?.running || (day?.check_in_at && day?.check_out_at) ? 0.45 : 1 }}>حضور</button>
                        <button disabled={!!busyId || !sess?.running} onClick={() => stopSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', opacity: !sess?.running ? 0.45 : 1 }}>انصراف</button>
                        <button disabled={!!busyId || !sess || sess.running} onClick={() => saveSession(emp.id)} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', opacity: !sess || sess.running ? 0.45 : 1 }}>{busyId === emp.id ? '...' : 'حفظ'}</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => openEdit(emp)} className="py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', border: '1px solid rgba(71,85,105,0.6)' }}>تعديل</button>
                        <button onClick={() => generateReport(emp.id)} className="py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(14,165,233,0.12)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)' }}>توليد تقرير</button>
                      </div>
                    </div>
                  )
                })}
                {!filtered.length && (
                  <div className="col-span-full text-center py-12 text-slate-500 card">لا يوجد موظفون بعد — اضغط «+ موظف جديد»</div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

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
              <button onClick={() => deleteEmployee(editEmp)} className="w-full py-2.5 rounded-xl text-sm" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>حذف الموظف</button>
            </div>
          </div>
        </div>
      )}

      {(fullReport || reportLoading) && (
        <ReportModal fullReport={fullReport} reportLoading={reportLoading} reportMonth={reportMonth} setReportMonth={setReportMonth} generateReport={generateReport} onClose={() => setFullReport(null)} />
      )}

      {showPanelGate && (
        <div className="modal-backdrop" onClick={() => setShowPanelGate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">لوحة التحكم</h2>
            <input type="password" className="input-field mb-3" value={panelPwd} onChange={(e) => setPanelPwd(e.target.value)} dir="ltr" placeholder="0000" />
            <button disabled={panelBusy} onClick={verifyPanel} className="btn-primary w-full">{panelBusy ? '...' : 'دخول'}</button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div className="modal-backdrop" onClick={() => setPanelOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-3">لوحة التحكم</h2>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([
                ['employees', 'الموظفون'],
                ...(isSuperAdmin ? [['cafes', 'الحسابات'] as const] : []),
                ['withdrawals', 'السحوبات'],
                ['rates', 'الصرف'],
                ['account', 'الحساب'],
              ] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id as typeof panelTab)} className="px-2.5 py-1.5 rounded-xl text-xs" style={{ background: panelTab === id ? 'rgba(14,165,233,0.2)' : 'rgba(30,41,59,0.9)', color: panelTab === id ? '#7dd3fc' : '#94a3b8', border: panelTab === id ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent' }}>{label}</button>
              ))}
            </div>
            {panelTab === 'employees' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {employees.filter((e) => e.status === 'active').map((emp) => (
                  <div key={emp.id} className="card flex items-center justify-between gap-2" style={{ padding: 12 }}>
                    <div><p className="text-sm text-white font-medium">{emp.full_name}</p><p className="text-xs text-slate-500">#{emp.employee_number}</p></div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(emp)} className="text-xs px-2.5 py-1.5 rounded-lg btn-secondary">تعديل</button>
                      <button onClick={() => deleteEmployee(emp)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {panelTab === 'cafes' && isSuperAdmin && (<TenantsTab onToast={showToast} />)}
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
                  else { showToast(true, 'تم'); setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' }) }
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
                <div><label className="label">اسم الكافيه / الموقع</label><input className="input-field" value={cafeName} onChange={(e) => setCafeName(e.target.value)} style={{ textAlign: 'right' }} />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_cafe_name', cafe_name: cafeName }) }); const d = await res.json(); if (res.ok) { setSiteTitle(cafeName.trim() || siteTitle); showToast(true, 'تم تغيير الاسم') } else showToast(false, d.error) }}>حفظ الاسم</button></div>
                <div><label className="label">البريد</label><input className="input-field" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_email', email: newEmail }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ</button></div>
                <div><label className="label">كلمة مرور اللوحة</label><input type="password" className="input-field" value={newPanelPwd} onChange={(e) => setNewPanelPwd(e.target.value)} dir="ltr" />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_panel_password', password: newPanelPwd }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ</button></div>
                <div><label className="label">كلمة سر الدخول للموقع</label><input type="password" className="input-field" value={newLoginPwd} onChange={(e) => setNewLoginPwd(e.target.value)} dir="ltr" placeholder="6 أحرف على الأقل" />
                  <button className="btn-secondary w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_password', password: newLoginPwd }) }); const d = await res.json(); if (res.ok) { setNewLoginPwd(''); showToast(true, 'تم تغيير كلمة سر الدخول') } else showToast(false, d.error) }}>حفظ كلمة سر الدخول</button></div>
              </div>
            )}
            <button onClick={() => setPanelOpen(false)} className="btn-secondary w-full mt-4">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
