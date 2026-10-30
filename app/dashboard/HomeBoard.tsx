'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReportModal from './ReportModal'
import TenantsTab from './TenantsTab'
import QrScanner, { EmployeeQrCard } from './QrPanel'

type Employee = {
  id: string
  full_name: string
  employee_number: string
  salary_amount: number
  work_hours_per_day: number
  status: string
  job_title: string | null
  phone: string | null
  pin_code: string | null
  hire_date: string | null
  notes: string | null
}
type DayInfo = { status: string; check_in_at: string | null; check_out_at: string | null; worked_minutes: number | null }
type Session = { startMs: number; endMs: number | null; running: boolean }
type Withdrawal = { id: string; employee_id: string; amount: number; currency: string; note: string | null; withdrawn_at: string }
type WeekDay = { label: string; present: number; absent: number }

const SESS_KEY = 'cafe_staff_sessions'
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

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
function nowClock() {
  return new Date().toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
}
function todayLabel() {
  return new Date().toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function currencyLabel(c: string) {
  if (c === 'SYP') return 'ل.س'
  if (c === 'TRY') return '₺'
  return '$'
}

function normalizeWhatsApp(phone: string | null | undefined) {
  if (!phone) return ''
  let raw = String(phone).trim()
  raw = raw.replace(/[\s\-().]/g, '')
  if (raw.startsWith('00')) raw = raw.slice(2)
  if (raw.startsWith('+')) raw = raw.slice(1)
  const p = raw.replace(/\D/g, '')
  return p
}

function sendWithdrawalWhatsApp(phone: string | null | undefined, amount: number | string, currency: string) {
  const n = normalizeWhatsApp(phone)
  if (!n) return false
  const now = new Date()
  const day = now.toLocaleDateString('ar-SY', { weekday: 'long' })
  const date = now.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })
  const time = now.toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
  const msg = `تم تسجيل سحب بمبلغ ${amount} ${currency}\nاليوم: ${day}\nالتاريخ: ${date}\nالساعة: ${time}`
  const url = `https://wa.me/${n}?text=${encodeURIComponent(msg)}`
  try { window.open(url, '_blank') } catch {}
  return true
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
  const [showQrScan, setShowQrScan] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [showQrEmp, setShowQrEmp] = useState<Employee | null>(null)
  const [fullReport, setFullReport] = useState<any | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', pin_code: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)
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
  const [form, setForm] = useState({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', notes: '', pin_code: '0000' })
  const [saving, setSaving] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [weekData, setWeekData] = useState<WeekDay[]>([])
  const [activeNav, setActiveNav] = useState('home')
  const [openSelect, setOpenSelect] = useState<null | 'emp' | 'cur'>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem('csp_sidebar_open')
      if (v === '0') setSidebarOpen(false)
      if (v === '1') setSidebarOpen(true)
    } catch {}
  }, [])

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const overlayOpen = panelOpen || showPanelGate || !!editEmp || showAdd || !!deleteTarget || mobileOpen || reportLoading || !!fullReport || showQrScan || !!showQrEmp
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    if (overlayOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = prev || ''
    return () => { document.body.style.overflow = prev || '' }
  }, [overlayOpen])

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
    const tmr = setTimeout(() => {
      try {
        if (Object.keys(sessions).length === 0) localStorage.removeItem(SESS_KEY)
        else localStorage.setItem(SESS_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), sessions }))
      } catch {}
    }, 200)
    return () => clearTimeout(tmr)
  }, [sessions, sessionsReady])

  const hasRunningSession = useMemo(() => Object.values(sessions).some((s) => s.running), [sessions])

  useEffect(() => {
    setClock(nowClock())
    const id = setInterval(() => setClock(nowClock()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!hasRunningSession) return
    const id = setInterval(() => setTick((x) => x + 1), 1000)
    const bump = () => {
      if (document.visibilityState === 'visible') setTick((x) => x + 1)
    }
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', bump)
      window.removeEventListener('focus', bump)
    }
  }, [hasRunningSession])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل')
      setEmployees(data.employees || [])
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data: days } = await supabase.from('daily_attendance').select('employee_id, status, check_in_at, check_out_at, worked_minutes, work_date').eq('work_date', today)
      const map: Record<string, DayInfo> = {}
      for (const d of days || []) {
        let status = d.status || 'none'
        if (d.check_in_at && d.check_out_at) status = 'checked_out'
        else if (d.check_in_at) status = 'present'
        map[d.employee_id] = { status, check_in_at: d.check_in_at, check_out_at: d.check_out_at, worked_minutes: d.worked_minutes }
      }
      setTodayMap(map)
      const from = new Date()
      from.setDate(from.getDate() - 6)
      const fromStr = from.toISOString().slice(0, 10)
      const { data: weekRows } = await supabase.from('daily_attendance').select('work_date, check_in_at, check_out_at, status').gte('work_date', fromStr).lte('work_date', today)
      const byDate: Record<string, { present: number; absent: number }> = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        byDate[d.toISOString().slice(0, 10)] = { present: 0, absent: 0 }
      }
      for (const r of weekRows || []) {
        if (!byDate[r.work_date]) byDate[r.work_date] = { present: 0, absent: 0 }
        if (r.status === 'absent') byDate[r.work_date].absent++
        else if (r.check_in_at) byDate[r.work_date].present++
      }
      setWeekData(Object.keys(byDate).sort().map((key) => {
        const d = new Date(key + 'T12:00:00')
        return { label: DAY_NAMES[d.getDay()], present: byDate[key].present, absent: byDate[key].absent }
      }))
      try {
        const wr = await fetch('/api/withdrawals')
        const wj = await wr.json()
        if (wr.ok) setWithdrawals(wj.withdrawals || [])
      } catch {}
    } catch (e: unknown) {
      showToast(false, e instanceof Error ? e.message : 'خطأ')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startSession = (empId: string) => {
    const day = todayMap[empId]
    if (day?.check_in_at && day?.check_out_at) { showToast(false, 'تم حفظ دوام هذا الموظف اليوم'); return }
    if (sessions[empId]?.running) return
    setSessions((prev) => ({ ...prev, [empId]: { startMs: Date.now(), endMs: null, running: true } }))
    showToast(true, 'بدأت الساعة')
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
    const end = s.running ? Date.now() : s.endMs || Date.now()
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
    setEditForm({ full_name: emp.full_name, salary_amount: String(emp.salary_amount || 0), work_hours_per_day: String(emp.work_hours_per_day || 8), job_title: emp.job_title || '', phone: emp.phone || '', pin_code: emp.pin_code || '', notes: emp.notes || '' })
  }
  const saveEdit = async () => {
    if (!editEmp) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/employees/${editEmp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: editForm.full_name, salary_amount: Number(editForm.salary_amount) || 0, work_hours_per_day: Number(editForm.work_hours_per_day) || 8, job_title: editForm.job_title || null, phone: editForm.phone || null, pin_code: editForm.pin_code || null, notes: editForm.notes || null }) })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم'); setEditEmp(null); load() }
    } catch { showToast(false, 'خطأ') }
    setEditSaving(false)
  }
  const requestDelete = (emp: Employee) => setDeleteTarget(emp)
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم الحذف'); setEditEmp(null); setDeleteTarget(null); load() }
    } catch { showToast(false, 'خطأ') }
    setDeleting(false)
  }

  const openControlPanel = () => {
    setShowPanelGate(true)
    setPanelPwd('')
  }

  const onLogoClick = () => {
    const now = Date.now()
    if (now - logoClicks.current.t > 2000) logoClicks.current = { n: 0, t: now }
    logoClicks.current.n += 1; logoClicks.current.t = now
    if (logoClicks.current.n >= 5) { logoClicks.current.n = 0; openControlPanel() }
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
        try { const sa = await fetch('/api/super-admin/tenants'); setIsSuperAdmin(sa.ok) } catch { setIsSuperAdmin(false) }
      }
    } catch { showToast(false, 'خطأ') }
    setPanelBusy(false)
  }

  const handleQrScan = useCallback(async (employeeId: string) => {
    setQrBusy(true)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, action: 'qr_toggle', method: 'qr' }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشل المسح')
        if (data.already_done) setShowQrScan(false)
      } else {
        showToast(true, data.message || 'تم')
        if (data.action === 'check_in') {
          setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'present', check_in_at: data.check_in_at, check_out_at: null, worked_minutes: null } }))
        } else if (data.action === 'check_out') {
          setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'checked_out', check_in_at: data.check_in_at, check_out_at: data.check_out_at, worked_minutes: data.worked_minutes } }))
        }
        setShowQrScan(false)
        load()
      }
    } catch { showToast(false, 'خطأ اتصال') }
    setQrBusy(false)
  }, [load])

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active')
    let working = 0, saved = 0, none = 0
    for (const e of active) {
      const sess = sessions[e.id]
      const day = todayMap[e.id]
      if (sess) working++
      else if (day?.check_in_at && day?.check_out_at) saved++
      else if (day?.check_in_at) working++
      else none++
    }
    return { total: active.length, working, saved, none, present: working + saved }
  }, [employees, todayMap, sessions])

  const filtered = useMemo(() => {
    const q = search.trim()
    const list = employees.filter((e) => e.status === 'active')
    if (!q) return list
    return list.filter((e) => e.full_name.includes(q) || e.employee_number.includes(q))
  }, [employees, search])

  const empNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employees) m[e.id] = e.full_name
    return m
  }, [employees])

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, salary_amount: Number(form.salary_amount) || 0, work_hours_per_day: Number(form.work_hours_per_day) || 8 }) })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else { showToast(true, 'تم'); setShowAdd(false); setForm({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', notes: '', pin_code: '0000' }); load() }
    } catch { showToast(false, 'خطأ') }
    setSaving(false)
  }

  const roleLabel = adminRole === 'owner' ? 'المالك' : adminRole === 'manager' ? 'مدير' : adminRole

  const navGo = (id: string) => {
    setActiveNav(id); setMobileOpen(false)
    if (id === 'add') setShowAdd(true)
    if (id === 'qr') setShowQrScan(true)
    if (id === 'panel') openControlPanel()
    if (id === 'home') window.scrollTo({ top: 0, behavior: 'smooth' })
    if (id === 'employees') document.getElementById('employees-section')?.scrollIntoView({ behavior: 'smooth' })
    if (id === 'withdrawals') document.getElementById('withdrawals-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {toast && (
        <div className="fixed bottom-5 left-5 z-[80] px-4 py-3 rounded-xl text-sm font-bold" style={{ background: toast.ok ? '#14241d' : '#2a1418', border: `1px solid ${toast.ok ? '#26865d' : '#d83e4d'}`, color: toast.ok ? '#d6ffea' : '#ffd0d4' }}>{toast.msg}</div>
      )}
      {mobileOpen && <div className="fixed inset-0 z-[15] md:hidden" style={{ background: 'rgba(0,0,0,.58)' }} onClick={() => setMobileOpen(false)} />}

      <aside className={`csp-sidebar fixed top-0 h-screen z-20 flex flex-col${mobileOpen ? ' open' : ''}${!sidebarOpen ? ' collapsed' : ''}`} style={{ width: 264, padding: '24px 16px', background: 'linear-gradient(180deg,#0d1115,#080b0e 78%)', borderLeft: '1px solid var(--line)' }}>
        <style>{`aside.csp-sidebar{right:0;transition:transform .28s ease,box-shadow .28s ease}.csp-main-wrap{transition:margin-right .28s ease}aside.csp-sidebar.collapsed{transform:translateX(110%)}.csp-main-wrap.full{margin-right:0!important}@media(max-width:768px){aside.csp-sidebar{right:-285px;width:270px;transform:none;box-shadow:-15px 0 40px rgba(0,0,0,.5)}aside.csp-sidebar.open{right:0}.csp-main-wrap{margin-right:0!important}}`}</style>
        <button type="button" onClick={onLogoClick} className="flex items-center gap-3 px-2.5 pb-6 mb-1 w-full text-right" style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(214,163,75,.18)' }}>
          <div>
            <h1 className="text-[19px] font-black m-0 leading-tight" style={{ color: 'var(--gold2)' }}>{siteTitle}</h1>
            <small className="text-[11px]" style={{ color: '#b8a47d' }}>نظام إدارة الحضور والانصراف</small>
          </div>
        </button>
        <nav className="grid gap-2 mt-6 flex-1">
          {[ { id: 'home', icon: '⌂', label: 'الرئيسية' }, { id: 'employees', icon: '♟', label: 'الموظفون' }, { id: 'qr', icon: '▣', label: 'مسح QR' }, { id: 'add', icon: '＋', label: 'إضافة موظف' }, { id: 'withdrawals', icon: '＄', label: 'السحوبات' }, { id: 'panel', icon: '⚙', label: 'لوحة التحكم' } ].map((item) => (
            <button key={item.id} type="button" className={`side-nav-item ${activeNav === item.id ? 'active' : ''}`} onClick={() => navGo(item.id)}>
              <span className="text-[19px] w-6 text-center" style={{ color: activeNav === item.id ? undefined : 'var(--gold)' }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 text-xs" style={{ borderTop: '1px solid rgba(214,163,75,.18)', color: '#b9a06e' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full grid place-items-center font-bold" style={{ background: 'linear-gradient(135deg,#5d4930,#17191b)', border: '1px solid var(--gold)', color: 'var(--gold2)' }}>{(adminName || 'م').charAt(0)}</div>
            <div className="text-right min-w-0">
              <p className="text-white text-sm font-bold truncate m-0">{adminName}</p>
              <p className="text-[11px] m-0" style={{ color: 'var(--muted)' }}>{roleLabel}</p>
            </div>
          </div>
          <button type="button" className="side-nav-item" style={{ color: '#ff7782' }} onClick={async () => { await createClient().auth.signOut(); router.push('/login') }}>خروج من الحساب</button>
        </div>
      </aside>

      <div className={`csp-main-wrap min-h-screen${!sidebarOpen ? ' full' : ''}`} style={{ marginRight: sidebarOpen ? 264 : 0 }}>
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-8" style={{ height: 64, borderBottom: '1px solid var(--line)', background: 'rgba(8,12,15,.88)', backdropFilter: 'blur(14px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-full grid place-items-center text-lg" style={{ background: 'linear-gradient(135deg,#5d4930,#17191b)', border: '1px solid var(--gold)' }}>♙</div>
            <div><strong className="text-[13px] block">{adminName}</strong><small className="text-[11px]" style={{ color: 'var(--muted)' }}>{roleLabel}</small></div>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#d5d8da' }}>
            <span className="hidden sm:inline">{todayLabel()} · {clock}</span>
            <button type="button" className="w-[38px] h-[38px] rounded-[11px] grid place-items-center" style={{ border: '1px solid var(--line)', background: '#11181d', color: 'var(--gold2)' }} onClick={() => setShowQrScan(true)} title="مسح QR">▣</button>
            <button type="button" className="grid place-items-center" title={sidebarOpen || mobileOpen ? 'إخفاء القائمة' : 'إظهار القائمة'} onClick={() => { if (typeof window !== 'undefined' && window.innerWidth <= 768) setMobileOpen((v) => !v); else setSidebarOpen((prev) => { const next = !prev; try { localStorage.setItem('csp_sidebar_open', next ? '1' : '0') } catch {}; return next }) }} style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(214,163,75,0.55)', background: 'linear-gradient(145deg, rgba(214,163,75,0.18), rgba(16,22,28,0.95))', color: 'var(--gold2)', boxShadow: '0 0 18px rgba(214,163,75,0.18)', fontSize: 18, fontWeight: 800 }}>{sidebarOpen || mobileOpen ? '⟫' : '⟪'}</button>
          </div>
        </header>

        <section className="max-w-[1600px] mx-auto px-3 md:px-7 py-5 md:py-6 space-y-4">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[{ label: 'إجمالي الموظفين', value: stats.total, note: 'موظف مسجل', icon: '♟' }, { label: 'الحضور اليوم', value: stats.present, note: `من أصل ${stats.total}`, icon: '✓' }, { label: 'لم يبدأوا', value: stats.none, note: 'هذا اليوم', icon: '○' }, { label: 'يعملون الآن', value: stats.working, note: 'جلسة نشطة', icon: '⏱' }].map((s) => (
              <div key={s.label} className="stat">
                <div>
                  <div className="text-[12px] md:text-[13px]" style={{ color: '#d0d4d7' }}>{s.label}</div>
                  <div className="text-[24px] md:text-[27px] font-black leading-tight" style={{ color: 'var(--gold2)' }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{s.note}</div>
                </div>
                <div className="w-[40px] md:w-[49px] h-[40px] md:h-[49px] rounded-full grid place-items-center text-lg shrink-0" style={{ border: '1px solid var(--gold)', color: 'var(--gold2)', background: 'rgba(214,163,75,.08)' }}>{s.icon}</div>
              </div>
            ))}
          </section>

          <section id="employees-section" className="card">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h3 className="m-0 text-sm font-extrabold" style={{ color: '#f3e5c7' }}><span className="ml-1.5" style={{ color: 'var(--gold)' }}>♟</span> قائمة الموظفين</h3>
              <div className="flex items-center gap-2 rounded-[11px] px-3 py-2 min-w-[200px] flex-1 sm:flex-none" style={{ border: '1px solid var(--line)', background: '#080e13' }}>
                <span>⌕</span>
                <input className="bg-transparent border-0 outline-none text-white text-xs w-full" placeholder="ابحث عن موظف..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ textAlign: 'right' }}'right' }} />
              </div>
            </div>
            {loading ? <p className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>جاري التحميل...</p> : (
              <div className="overflow-x-auto rounded-[10px]" style={{ border: '1px solid rgba(214,163,75,.22)' }}>
                <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead><tr style={{ background: '#151e24' }}>{['#', 'الموظف', 'الوظيفة', 'الراتب', 'الحالة', 'الحضور', 'الانصراف', 'الساعة', 'إجراءات'].map((h) => (<th key={h} className="px-2 py-2.5 whitespace-nowrap font-bold" style={{ color: '#e5d4ad' }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {filtered.map((emp, idx) => {
                      const day = todayMap[emp.id]
                      const sess = sessions[emp.id]
                      const elapsed = getElapsedLabel(emp.id)
                      let statusLabel = 'لم يسجل', pillCls = 'gold'
                      if (sess?.running) { statusLabel = 'يعمل'; pillCls = '' }
                      else if (sess && !sess.running) { statusLabel = 'متوقف'; pillCls = 'orange' }
                      else if (day?.check_in_at && day?.check_out_at) { statusLabel = 'محفوظ'; pillCls = 'blue' }
                      else if (day?.check_in_at) { statusLabel = 'حاضر'; pillCls = '' }
                      return (
                        <tr key={emp.id}>
                          <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{idx + 1}</td>
                          <td className="px-2 py-2" style={{ borderTop: '1px solid rgba(180,190,200,.12)' }}><div className="flex items-center gap-2"><span className="w-7 h-7 rounded-full grid place-items-center text-xs" style={{ background: '#29343b', border: '1px solid #6d7376' }}>{emp.full_name.charAt(0)}</span><span className="text-white font-medium">{emp.full_name}</span></div></td>
                          <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{emp.job_title || '—'}</td>
                          <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: 'var(--gold2)' }}>${Number(emp.salary_amount || 0).toFixed(0)}</td>
                          <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)' }}><span className={`pill ${pillCls}`}>{statusLabel}</span></td>
                          <td className="px-2 py-2 text-center" dir="ltr" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{sess ? fmtTime(new Date(sess.startMs).toISOString()) : fmtTime(day?.check_in_at || null)}</td>
                          <td className="px-2 py-2 text-center" dir="ltr" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{sess?.endMs ? fmtTime(new Date(sess.endMs).toISOString()) : fmtTime(day?.check_out_at || null)}</td>
                          <td className="px-2 py-2 text-center font-bold" dir="ltr" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: sess?.running ? '#55d39d' : '#dce1e4' }}>{elapsed || (day?.worked_minutes != null ? `${Math.floor(day.worked_minutes / 60)}:${String(day.worked_minutes % 60).padStart(2, '0')}` : '—')}</td>
                          <td className="px-2 py-2" style={{ borderTop: '1px solid rgba(180,190,200,.12)' }}>
                            <div className="flex justify-center gap-1 flex-wrap">
                              <button type="button" disabled={!!busyId || !!sess?.running || !!(day?.check_in_at && day?.check_out_at)} onClick={() => startSession(emp.id)} className="px-1.5 py-1 rounded text-[10px] font-bold" style={{ border: '1px solid #16a36b', background: '#121a20', color: '#55d39d', opacity: sess?.running || (day?.check_in_at && day?.check_out_at) ? 0.4 : 1 }}>حضور</button>
                              <button type="button" disabled={!!busyId || !sess?.running} onClick={() => stopSession(emp.id)} className="px-1.5 py-1 rounded text-[10px] font-bold" style={{ border: '1px solid #d83e4d', background: '#121a20', color: '#ff7782', opacity: !sess?.running ? 0.4 : 1 }}>انصراف</button>
                              <button type="button" disabled={!!busyId || !sess || sess.running} onClick={() => saveSession(emp.id)} className="px-1.5 py-1 rounded text-[10px] font-bold" style={{ border: '1px solid var(--line)', background: '#121a20', color: 'var(--gold2)', opacity: !sess || sess.running ? 0.4 : 1 }}>{busyId === emp.id ? '...' : 'حفظ'}</button>
                              <button type="button" onClick={() => openEdit(emp)} className="px-1.5 py-1 rounded text-[10px]" style={{ border: '1px solid var(--line)', background: '#121a20', color: 'var(--gold2)' }}>✎</button>
                              <button type="button" onClick={() => setShowQrEmp(emp)} className="px-1.5 py-1 rounded text-[10px]" style={{ border: '1px solid var(--line)', background: '#121a20', color: 'var(--gold2)' }}>QR</button>
                              <button type="button" onClick={() => generateReport(emp.id)} className="px-1.5 py-1 rounded text-[10px]" style={{ border: '1px solid var(--line)', background: '#121a20', color: 'var(--gold2)' }}>تقرير</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {!filtered.length && <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--muted)' }}>لا يوجد موظفون</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section id="withdrawals-section" className="card">
            <h3 className="m-0 mb-3 text-sm font-extrabold" style={{ color: '#f3e5c7' }}><span className="ml-1.5" style={{ color: 'var(--gold)' }}>＄</span> أحدث السحوبات</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 320, borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#151e24' }}>{['الموظف', 'المبلغ', 'العملة', 'الوقت'].map((h) => (<th key={h} className="px-2 py-2 text-center font-bold" style={{ color: '#e5d4ad' }}>{h}</th>))}</tr></thead>
                <tbody>
                  {withdrawals.slice(0, 8).map((w) => (
                    <tr key={w.id}>
                      <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{empNameById[w.employee_id] || '—'}</td>
                      <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: 'var(--gold2)' }}>{Number(w.amount).toLocaleString()}</td>
                      <td className="px-2 py-2 text-center" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{w.currency}</td>
                      <td className="px-2 py-2 text-center" dir="ltr" style={{ borderTop: '1px solid rgba(180,190,200,.12)', color: '#dce1e4' }}>{fmtTime(w.withdrawn_at)}</td>
                    </tr>
                  ))}
                  {!withdrawals.length && <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--muted)' }}>لا توجد سحوبات</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>

      {showAdd && (
        <div className="modal-backdrop" style={{ zIndex: 70 }} onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-4 font-black" style={{ color: 'var(--gold2)' }}>＋ إضافة موظف جديد</h3>
            <form onSubmit={addEmployee} className="space-y-3">
              <div><label className="label">الاسم *</label><input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الرقم *</label><input className="input-field" required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} dir="ltr" /></div>
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} dir="ltr" /></div>
              </div>
              <div><label className="label">واتساب / هاتف دولي</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="+90 5xx xxx xxxx" style={{ textAlign: 'left' }} /></div>
              <div className="flex gap-2"><button type="submit" disabled={saving} className="btn-gold flex-1">{saving ? '...' : 'حفظ'}</button><button type="button" onClick={() => setShowAdd(false)} className="btn-dark">إلغاء</button></div>
            </form>
          </div>
        </div>
      )}

      {editEmp && (
        <div className="modal-backdrop" style={{ zIndex: 80 }} onClick={() => setEditEmp(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black" style={{ color: 'var(--gold2)' }}>تعديل موظف</h3>
            <div className="space-y-3">
              <div><label className="label">الاسم</label><input className="input-field" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={editForm.salary_amount} onChange={(e) => setEditForm({ ...editForm, salary_amount: e.target.value })} dir="ltr" /></div>
                <div><label className="label">ساعات/يوم</label><input className="input-field" type="number" value={editForm.work_hours_per_day} onChange={(e) => setEditForm({ ...editForm, work_hours_per_day: e.target.value })} dir="ltr" /></div>
              </div>
              <div><label className="label">واتساب / هاتف دولي</label><input className="input-field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} dir="ltr" placeholder="+90 5xx xxx xxxx" style={{ textAlign: 'left' }} /></div>
              <div className="flex gap-2"><button onClick={saveEdit} disabled={editSaving} className="btn-gold flex-1">{editSaving ? '...' : 'حفظ'}</button><button onClick={() => setEditEmp(null)} className="btn-dark">إلغاء</button></div>
              <button type="button" className="btn-dark w-full" onClick={() => setShowQrEmp(editEmp)}>عرض QR الموظف</button>
              <button onClick={() => requestDelete(editEmp)} className="w-full btn-danger">حذف الموظف</button>
            </div>
          </div>
        </div>
      )}

      {(fullReport || reportLoading) && (
        <ReportModal fullReport={fullReport} reportLoading={reportLoading} reportMonth={reportMonth} setReportMonth={setReportMonth} generateReport={generateReport} onClose={() => setFullReport(null)} />
      )}

      {showPanelGate && (
        <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => setShowPanelGate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black" style={{ color: 'var(--gold2)' }}>لوحة التحكم</h3>
            <input type="password" className="input-field mb-3" value={panelPwd} onChange={(e) => setPanelPwd(e.target.value)} dir="ltr" placeholder="كلمة السر" autoComplete="off" />
            <button disabled={panelBusy} onClick={verifyPanel} className="btn-gold w-full mb-2">{panelBusy ? '...' : 'دخول'}</button>
            <button onClick={() => setShowPanelGate(false)} className="btn-dark w-full">إلغاء</button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => { setOpenSelect(null); setPanelOpen(false) }}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black" style={{ color: 'var(--gold2)' }}>لوحة التحكم</h3>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([['employees', 'الموظفون'], ...(isSuperAdmin ? [['cafes', 'الحسابات'] as const] : []), ['withdrawals', 'السحوبات'], ['rates', 'الصرف'], ['account', 'الحساب']] as const).map(([id, label]) => (
                <button key={id} onClick={() => { setPanelTab(id as typeof panelTab); setOpenSelect(null) }} className="px-2.5 py-1.5 rounded-xl text-xs" style={{ background: panelTab === id ? 'rgba(214,163,75,.18)' : '#111920', color: panelTab === id ? 'var(--gold2)' : 'var(--muted)', border: panelTab === id ? '1px solid var(--line)' : '1px solid transparent' }}>{label}</button>
              ))}
            </div>
            {panelTab === 'employees' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {employees.filter((e) => e.status === 'active').map((emp) => (
                  <div key={emp.id} className="card flex items-center justify-between gap-2" style={{ padding: 12 }}>
                    <div><p className="text-sm text-white font-medium m-0">{emp.full_name}</p><p className="text-xs m-0" style={{ color: 'var(--muted)' }}>#{emp.employee_number}{emp.phone ? ` · ${emp.phone}` : ''}</p></div>
                    <div className="flex gap-1.5"><button onClick={() => openEdit(emp)} className="text-xs px-2.5 py-1.5 rounded-lg btn-dark">تعديل</button><button onClick={() => setShowQrEmp(emp)} className="text-xs px-2.5 py-1.5 rounded-lg btn-dark">QR</button><button onClick={() => requestDelete(emp)} className="text-xs px-2.5 py-1.5 rounded-lg btn-danger">حذف</button></div>
                  </div>
                ))}
              </div>
            )}
            {panelTab === 'cafes' && isSuperAdmin && <TenantsTab onToast={showToast} />}
            {panelTab === 'withdrawals' && (
              <div className="space-y-3">
                <div className="relative">
                  <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-right" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.45)', color: '#f3e5c7' }} onClick={() => setOpenSelect(openSelect === 'emp' ? null : 'emp')}>
                    <span style={{ color: 'var(--gold2)', fontSize: 12 }}>▾</span>
                    <span className="flex-1 truncate">{wForm.employee_id ? (employees.find((x) => x.id === wForm.employee_id)?.full_name || 'موظف') + (employees.find((x) => x.id === wForm.employee_id)?.phone ? ` · ${employees.find((x) => x.id === wForm.employee_id)?.phone}` : '') : 'اختر موظف'}</span>
                  </button>
                  {openSelect === 'emp' && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl shadow-xl" style={{ background: '#0e151c', border: '1px solid rgba(214,163,75,.5)', boxShadow: '0 12px 40px rgba(0,0,0,.55)' }}>
                      <button type="button" className="w-full text-right px-3 py-2.5 text-sm" style={{ color: 'var(--muted)', borderBottom: '1px solid rgba(214,163,75,.12)' }} onClick={() => { setWForm({ ...wForm, employee_id: '' }); setOpenSelect(null) }}>اختر موظف</button>
                      {employees.filter((e) => e.status === 'active').map((e) => (
                        <button key={e.id} type="button" className="w-full text-right px-3 py-2.5 text-sm" style={{ color: wForm.employee_id === e.id ? 'var(--gold2)' : '#e8eef2', background: wForm.employee_id === e.id ? 'rgba(214,163,75,.12)' : 'transparent', borderBottom: '1px solid rgba(214,163,75,.08)' }} onClick={() => { setWForm({ ...wForm, employee_id: e.id }); setOpenSelect(null) }}>
                          {e.full_name}{e.phone ? ` · ${e.phone}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-field" type="text" inputMode="decimal" placeholder="المبلغ" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} dir="ltr" />
                  <div className="relative">
                    <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.45)', color: '#f3e5c7' }} onClick={() => setOpenSelect(openSelect === 'cur' ? null : 'cur')}>
                      <span style={{ color: 'var(--gold2)', fontSize: 12 }}>▾</span>
                      <span>{wForm.currency}</span>
                    </button>
                    {openSelect === 'cur' && (
                      <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-xl" style={{ background: '#0e151c', border: '1px solid rgba(214,163,75,.5)' }}>
                        {(['USD', 'SYP', 'TRY'] as const).map((c) => (
                          <button key={c} type="button" className="w-full text-right px-3 py-2.5 text-sm" style={{ color: wForm.currency === c ? 'var(--gold2)' : '#e8eef2', background: wForm.currency === c ? 'rgba(214,163,75,.12)' : 'transparent', borderBottom: '1px solid rgba(214,163,75,.08)' }} onClick={() => { setWForm({ ...wForm, currency: c }); setOpenSelect(null) }}>{c}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button type="button" className="btn-dark w-full text-sm" disabled={panelBusy} onClick={async () => {
                    if (!wForm.employee_id || !wForm.amount) { showToast(false, 'اختر موظفاً وأدخل المبلغ'); return }
                    setPanelBusy(true)
                    try {
                      const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wForm) })
                      const d = await res.json()
                      if (!res.ok) showToast(false, d.error || 'فشل')
                      else {
                        showToast(true, 'تم تسجيل السحب في الملف')
                        setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' })
                        load()
                      }
                    } catch { showToast(false, 'خطأ اتصال') }
                    setPanelBusy(false)
                  }}>تسجيل سحب فقط</button>
                  <button type="button" className="btn-gold w-full text-sm" disabled={panelBusy} onClick={async () => {
                    if (!wForm.employee_id || !wForm.amount) { showToast(false, 'اختر موظفاً وأدخل المبلغ'); return }
                    setPanelBusy(true)
                    try {
                      const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wForm) })
                      const d = await res.json()
                      if (!res.ok) showToast(false, d.error || 'فشل')
                      else {
                        const emp = employees.find((x) => x.id === wForm.employee_id)
                        const sent = sendWithdrawalWhatsApp(emp?.phone, wForm.amount, wForm.currency)
                        showToast(true, sent ? 'تم التسجيل وفُتح واتساب للإرسال' : 'تم التسجيل — لا يوجد رقم واتساب للموظف')
                        setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' })
                        load()
                      }
                    } catch { showToast(false, 'خطأ اتصال') }
                    setPanelBusy(false)
                  }}>تسجيل سحب عبر واتساب</button>
                </div>
              </div>
            )}
            {panelTab === 'rates' && (
              <div className="space-y-3">
                <div><label className="label">SYP لكل 1 USD</label><input className="input-field" type="number" value={rateSyp} onChange={(e) => setRateSyp(e.target.value)} dir="ltr" /></div>
                <div><label className="label">TRY لكل 1 USD</label><input className="input-field" type="number" value={rateTry} onChange={(e) => setRateTry(e.target.value)} dir="ltr" /></div>
                <button className="btn-gold w-full" disabled={panelBusy} onClick={async () => {
                  setPanelBusy(true)
                  try {
                    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_rates', rate_syp_per_usd: rateSyp, rate_try_per_usd: rateTry }) })
                    const d = await res.json()
                    if (!res.ok) showToast(false, d.error || 'فشل الحفظ')
                    else { if (d.rate_syp_per_usd) setRateSyp(String(d.rate_syp_per_usd)); if (d.rate_try_per_usd) setRateTry(String(d.rate_try_per_usd)); showToast(true, 'تم حفظ أسعار الصرف') }
                  } catch { showToast(false, 'خطأ اتصال') }
                  setPanelBusy(false)
                }}>{panelBusy ? '...' : 'حفظ'}</button>
              </div>
            )}
            {panelTab === 'account' && (
              <div className="space-y-3">
                <div><label className="label">اسم الموقع</label><input className="input-field" value={cafeName} onChange={(e) => setCafeName(e.target.value)} style={{ textAlign: 'right' }} /><button className="btn-dark w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_cafe_name', cafe_name: cafeName }) }); const d = await res.json(); if (res.ok) { setSiteTitle(cafeName.trim() || siteTitle); showToast(true, 'تم') } else showToast(false, d.error) }}>حفظ الاسم</button></div>
                <div><label className="label">البريد</label><input className="input-field" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} /><button className="btn-dark w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_email', email: newEmail }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ</button></div>
                <div><label className="label">كلمة مرور اللوحة</label><input type="password" className="input-field" value={newPanelPwd} onChange={(e) => setNewPanelPwd(e.target.value)} dir="ltr" /><button className="btn-dark w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_panel_password', password: newPanelPwd }) }); const d = await res.json(); showToast(res.ok, res.ok ? 'تم' : d.error) }}>حفظ</button></div>
                <div><label className="label">كلمة سر الدخول</label><input type="password" className="input-field" value={newLoginPwd} onChange={(e) => setNewLoginPwd(e.target.value)} dir="ltr" /><button className="btn-dark w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_password', password: newLoginPwd }) }); const d = await res.json(); if (res.ok) { setNewLoginPwd(''); showToast(true, 'تم') } else showToast(false, d.error) }}>حفظ كلمة السر</button></div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              <button onClick={() => { setOpenSelect(null); setPanelOpen(false) }} className="btn-dark w-full">إغلاق اللوحة</button>
              <button onClick={async () => { setPanelOpen(false); await createClient().auth.signOut(); router.push('/login') }} className="w-full btn-danger">خروج من الحساب</button>
            </div>
          </div>
        </div>
      )}

      {showQrScan && (
        <QrScanner busy={qrBusy} onClose={() => setShowQrScan(false)} onScan={handleQrScan} />
      )}

      {showQrEmp && (
        <div className="modal-backdrop" style={{ zIndex: 86 }} onClick={() => setShowQrEmp(null)}>
          <div className="modal-panel" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black text-center" style={{ color: 'var(--gold2)' }}>QR — {showQrEmp.full_name}</h3>
            <EmployeeQrCard employeeId={showQrEmp.id} name={showQrEmp.full_name} size={200} />
            <p className="text-xs text-center mt-3 mb-3" style={{ color: 'var(--muted)' }}>هذا الرمز ثابت ومربوط بملف الموظف.</p>
            <button type="button" className="btn-dark w-full" onClick={() => setShowQrEmp(null)}>إغلاق</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 90 }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 className="m-0 mb-2 font-black text-center" style={{ color: 'var(--gold2)' }}>تأكيد الحذف</h3>
            <p className="text-sm text-center m-0 mb-5" style={{ color: '#c8d0d6', lineHeight: 1.7 }}>
              هل تريد حذف الموظف<br /><strong style={{ color: '#fff' }}>«{deleteTarget.full_name}»</strong>
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={deleting} onClick={confirmDelete} className="btn-danger flex-1">{deleting ? '...' : 'حذف'}</button>
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="btn-dark flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
