'use client'

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EmployeeQrCard } from './QrPanel'
import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'

const ReportModal = dynamic(() => import('./ReportModal'), { ssr: false })
const TenantsTab = dynamic(() => import('./TenantsTab'), { ssr: false })
const QrScanner = dynamic(() => import('./QrPanel'), { ssr: false })

const LiveClock = memo(function LiveClock() {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }))
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })), 1000)
    return () => clearInterval(id)
  }, [])
  const label = new Date().toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return <span className="hidden sm:inline">{label} · {clock}</span>
})

type Employee = { id: string; full_name: string; employee_number: string; salary_amount: number; work_hours_per_day: number; status: string; job_title: string | null; phone: string | null; pin_code: string | null; hire_date: string | null; notes: string | null }
type DayInfo = { status: string; check_in_at: string | null; check_out_at: string | null; worked_minutes: number | null }
type Session = { startMs: number; endMs: number | null; running: boolean }
type Withdrawal = { id: string; employee_id: string; amount: number; currency: string; note: string | null; withdrawn_at: string }

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
function normalizeWhatsApp(phone: string | null | undefined) {
  if (!phone) return ''
  let raw = String(phone).trim().replace(/[\s\-().]/g, '')
  if (raw.startsWith('00')) raw = raw.slice(2)
  if (raw.startsWith('+')) raw = raw.slice(1)
  return raw.replace(/\D/g, '')
}
function sendWithdrawalWhatsApp(phone: string | null | undefined, amount: number | string, currency: string) {
  const n = normalizeWhatsApp(phone)
  if (!n) return false
  const now = new Date()
  const day = now.toLocaleDateString('ar-SY', { weekday: 'long' })
  const date = now.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })
  const time = now.toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
  const msg = `تم تسجيل سحب بمبلغ ${amount} ${currency}\nاليوم: ${day}\nالتاريخ: ${date}\nالساعة: ${time}`
  try { window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, '_blank') } catch {}
  return true
}

export default function HomeBoard({ adminName, adminRole, cafeName: cafeNameProp = 'Cafe Staff Pro' }: { adminName: string; adminRole: string; cafeName?: string }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayMap, setTodayMap] = useState<Record<string, DayInfo>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [sessionsReady, setSessionsReady] = useState(false)
  const [tick, setTick] = useState(0)
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
  const [reportMonth, setReportMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` })
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
  const [editWithdrawal, setEditWithdrawal] = useState<Withdrawal | null>(null)
  const [editWForm, setEditWForm] = useState({ amount: '', currency: 'USD', note: '', employee_id: '' })
  const [editWSaving, setEditWSaving] = useState(false)
  const [deleteWithdrawal, setDeleteWithdrawal] = useState<Withdrawal | null>(null)
  const [deletingW, setDeletingW] = useState(false)
  const [form, setForm] = useState({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', notes: '', pin_code: '0000' })
  const [saving, setSaving] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [activeNav, setActiveNav] = useState('home')
  const [openSelect, setOpenSelect] = useState<null | 'emp' | 'cur'>(null)

  useEffect(() => { try { const v = localStorage.getItem('csp_sidebar_open'); if (v === '0') setSidebarOpen(false); if (v === '1') setSidebarOpen(true) } catch {} }, [])
  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 2200) }
  const overlayOpen = panelOpen || showPanelGate || !!editEmp || showAdd || !!deleteTarget || mobileOpen || reportLoading || !!fullReport || showQrScan || !!showQrEmp || !!editWithdrawal || !!deleteWithdrawal
  useEffect(() => { if (typeof document === 'undefined') return; const prev = document.body.style.overflow; if (overlayOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = prev || ''; return () => { document.body.style.overflow = prev || '' } }, [overlayOpen])
  useEffect(() => { try { const raw = localStorage.getItem(SESS_KEY); if (raw) { const parsed = JSON.parse(raw); const today = new Date().toISOString().slice(0, 10); if (parsed.date === today && parsed.sessions) setSessions(parsed.sessions); else localStorage.removeItem(SESS_KEY) } } catch {}; setSessionsReady(true) }, [])
  useEffect(() => { if (!sessionsReady) return; const tmr = setTimeout(() => { try { if (Object.keys(sessions).length === 0) localStorage.removeItem(SESS_KEY); else localStorage.setItem(SESS_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), sessions })) } catch {} }, 200); return () => clearTimeout(tmr) }, [sessions, sessionsReady])
  const hasRunningSession = useMemo(() => Object.values(sessions).some((s) => s.running), [sessions])
  useEffect(() => { if (!hasRunningSession) return; const id = setInterval(() => setTick((x) => x + 1), 1000); const bump = () => { if (document.visibilityState === 'visible') setTick((x) => x + 1) }; document.addEventListener('visibilitychange', bump); window.addEventListener('focus', bump); return () => { clearInterval(id); document.removeEventListener('visibilitychange', bump); window.removeEventListener('focus', bump) } }, [hasRunningSession])

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const [empRes, daysRes, wrRes] = await Promise.all([
        fetch('/api/employees').then(async (r) => ({ ok: r.ok, data: await r.json() })),
        supabase.from('daily_attendance').select('employee_id, status, check_in_at, check_out_at, worked_minutes, work_date').eq('work_date', today),
        fetch('/api/withdrawals').then(async (r) => ({ ok: r.ok, data: await r.json() })).catch(() => ({ ok: false, data: {} })),
      ])
      if (!empRes.ok) throw new Error(empRes.data.error || 'فشل')
      setEmployees(empRes.data.employees || [])
      const map: Record<string, DayInfo> = {}
      for (const d of daysRes.data || []) {
        let status = d.status || 'none'
        if (d.check_in_at && d.check_out_at) status = 'checked_out'
        else if (d.check_in_at) status = 'present'
        map[d.employee_id] = { status, check_in_at: d.check_in_at, check_out_at: d.check_out_at, worked_minutes: d.worked_minutes }
      }
      setTodayMap(map)
      if (wrRes.ok) setWithdrawals(wrRes.data.withdrawals || [])
    } catch (e: unknown) { showToast(false, e instanceof Error ? e.message : 'خطأ') }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const handleQrScan = useCallback(async (employeeId: string) => {
    setShowQrScan(false)
    setQrBusy(true)
    const emp = employees.find((e) => e.id === employeeId)
    const name = emp?.full_name || 'موظف'
    const day = todayMap[employeeId]
    const hasIn = !!(day?.check_in_at)
    const hasOut = !!(day?.check_out_at)
    const nowIso = new Date().toISOString()
    if (hasIn && hasOut) {
      showToast(false, `تم تسجيل حضور وانصراف «${name}» لهذا اليوم`)
      setQrBusy(false)
      return
    }
    if (!hasIn) {
      setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'present', check_in_at: nowIso, check_out_at: null, worked_minutes: null } }))
      showToast(true, `تم تسجيل حضور «${name}»`)
    } else {
      const start = day?.check_in_at ? new Date(day.check_in_at).getTime() : Date.now()
      const mins = Math.max(0, Math.round((Date.now() - start) / 60000))
      setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'checked_out', check_in_at: day?.check_in_at || nowIso, check_out_at: nowIso, worked_minutes: mins } }))
      showToast(true, `تم تسجيل انصراف «${name}»`)
    }
    try {
      const res = await fetch('/api/attendance/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: employeeId, action: 'qr_toggle', method: 'qr' }) })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشل حفظ التسجيل على السيرفر')
        void load()
      } else if (data.action === 'check_in') {
        setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'present', check_in_at: data.check_in_at, check_out_at: null, worked_minutes: null } }))
      } else if (data.action === 'check_out') {
        setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'checked_out', check_in_at: data.check_out_at ? data.check_in_at : data.check_in_at, check_out_at: data.check_out_at, worked_minutes: data.worked_minutes } }))
      }
    } catch {
      showToast(false, 'خطأ اتصال — أعد المحاولة')
      void load()
    }
    setQrBusy(false)
  }, [employees, todayMap, load])

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
      const res = await fetch('/api/attendance/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId, action: 'save_session', check_in_at: new Date(s.startMs).toISOString(), check_out_at: new Date(s.endMs).toISOString() }) })
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

  const openControlPanel = () => { setShowPanelGate(true); setPanelPwd('') }
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {toast && <div className="fixed bottom-5 left-5 z-[80] px-4 py-3 rounded-xl text-sm font-bold" style={{ background: toast.ok ? '#14241d' : '#2a1418', border: `1px solid ${toast.ok ? '#26865d' : '#d83e4d'}`, color: toast.ok ? '#d6ffea' : '#ffd0d4' }}>{toast.msg}</div>}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4" style={{ height: 64, borderBottom: '1px solid var(--line)', background: 'rgba(8,12,15,.88)' }}>
        <strong style={{ color: 'var(--gold2)' }}>{siteTitle || cafeNameProp}</strong>
        <div className="flex gap-2 flex-wrap justify-end">
          <button type="button" className="btn-dark" onClick={() => setShowQrScan(true)}>مسح QR</button>
          <button type="button" className="btn-dark" onClick={openControlPanel}>لوحة التحكم</button>
          <button type="button" className="btn-dark" onClick={() => setShowAdd(true)}>إضافة موظف</button>
          <button type="button" className="btn-dark" onClick={async () => { await createClient().auth.signOut(); router.push('/login') }}>خروج</button>
        </div>
      </header>
      <main className="p-4 max-w-5xl mx-auto space-y-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{loading ? 'جاري التحميل...' : `${employees.filter(e=>e.status==='active').length} موظف`}</p>
        <div className="space-y-2">
          {employees.filter(e=>e.status==='active').map((emp) => {
            const day = todayMap[emp.id]
            const sess = sessions[emp.id]
            let st = 'لم يسجل'
            if (sess?.running) st = 'يعمل'
            else if (sess && !sess.running) st = 'متوقف'
            else if (day?.check_in_at && day?.check_out_at) st = 'محفوظ'
            else if (day?.check_in_at) st = 'حاضر'
            return (
              <div key={emp.id} className="card flex items-center justify-between gap-2 flex-wrap" style={{ padding: 12 }}>
                <div className="min-w-0">
                  <p className="m-0 text-white font-bold">{emp.full_name}</p>
                  <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>{st} · {fmtTime(day?.check_in_at || null)} - {fmtTime(day?.check_out_at || null)}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button type="button" className="btn-dark text-xs" disabled={!!sess?.running || !!(day?.check_in_at && day?.check_out_at)} onClick={() => startSession(emp.id)}>حضور</button>
                  <button type="button" className="btn-dark text-xs" disabled={!sess?.running} onClick={() => stopSession(emp.id)}>انصراف</button>
                  <button type="button" className="btn-dark text-xs" disabled={!sess || sess.running} onClick={() => saveSession(emp.id)}>حفظ</button>
                  <button type="button" className="btn-dark text-xs" onClick={() => setShowQrEmp(emp)}>QR</button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {showAdd && (
        <div className="modal-backdrop" style={{ zIndex: 70 }} onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-4 font-black" style={{ color: 'var(--gold2)' }}>إضافة موظف</h3>
            <form onSubmit={async (e) => {
              e.preventDefault(); setSaving(true)
              try {
                const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, salary_amount: Number(form.salary_amount) || 0, work_hours_per_day: Number(form.work_hours_per_day) || 8 }) })
                const data = await res.json()
                if (!res.ok) showToast(false, data.error || 'فشل'); else { showToast(true, 'تم'); setShowAdd(false); setForm({ full_name: '', employee_number: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', notes: '', pin_code: '0000' }); load() }
              } catch { showToast(false, 'خطأ') }
              setSaving(false)
            }} className="space-y-3">
              <div><label className="label">الاسم *</label><input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الرقم *</label><input className="input-field" required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} dir="ltr" /></div>
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} dir="ltr" /></div>
              </div>
              <div className="flex gap-2"><button type="submit" disabled={saving} className="btn-gold flex-1">{saving ? '...' : 'حفظ'}</button><button type="button" onClick={() => setShowAdd(false)} className="btn-dark">إلغاء</button></div>
            </form>
          </div>
        </div>
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
        <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => setPanelOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black" style={{ color: 'var(--gold2)' }}>لوحة التحكم</h3>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([['employees', 'الموظفون'], ...(isSuperAdmin ? [['cafes', 'الحسابات'] as const] : []), ['withdrawals', 'السحوبات'], ['rates', 'الصرف'], ['account', 'الحساب']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id as typeof panelTab)} className="px-2.5 py-1.5 rounded-xl text-xs" style={{ background: panelTab === id ? 'rgba(214,163,75,.18)' : '#111920', color: panelTab === id ? 'var(--gold2)' : 'var(--muted)', border: panelTab === id ? '1px solid var(--line)' : '1px solid transparent' }}>{label}</button>
              ))}
            </div>
            {panelTab === 'employees' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {employees.filter((e) => e.status === 'active').map((emp) => (
                  <div key={emp.id} className="card flex items-center justify-between gap-2" style={{ padding: 12 }}>
                    <div><p className="text-sm text-white font-medium m-0">{emp.full_name}</p><p className="text-xs m-0" style={{ color: 'var(--muted)' }}>#{emp.employee_number}</p></div>
                    <button onClick={() => setShowQrEmp(emp)} className="text-xs px-2.5 py-1.5 rounded-lg btn-dark">QR</button>
                  </div>
                ))}
              </div>
            )}
            {panelTab === 'cafes' && isSuperAdmin && <TenantsTab onToast={showToast} />}
            {panelTab === 'withdrawals' && (
              <div className="space-y-3">
                <select className="input-field" value={wForm.employee_id} onChange={(e) => setWForm({ ...wForm, employee_id: e.target.value })} style={{ textAlign: 'right' }}>
                  <option value="">اختر موظف</option>
                  {employees.filter((e) => e.status === 'active').map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-field" type="text" inputMode="decimal" placeholder="المبلغ" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} dir="ltr" />
                  <select className="input-field" value={wForm.currency} onChange={(e) => setWForm({ ...wForm, currency: e.target.value })}>
                    <option value="USD">USD</option><option value="SYP">SYP</option><option value="TRY">TRY</option>
                  </select>
                </div>
                <button type="button" className="btn-gold w-full" disabled={panelBusy} onClick={async () => {
                  if (!wForm.employee_id || !wForm.amount) { showToast(false, 'اختر موظفاً وأدخل المبلغ'); return }
                  setPanelBusy(true)
                  try {
                    const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wForm) })
                    const d = await res.json()
                    if (!res.ok) showToast(false, d.error || 'فشل')
                    else { showToast(true, 'تم تسجيل السحب'); setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' }); load() }
                  } catch { showToast(false, 'خطأ اتصال') }
                  setPanelBusy(false)
                }}>تسجيل سحب</button>
                {wForm.employee_id && (
                  <EmployeeWithdrawalFile employeeId={wForm.employee_id} employeeName={employees.find(e=>e.id===wForm.employee_id)?.full_name || 'موظف'} withdrawals={withdrawals} onEdit={(w)=>{ setEditWithdrawal(w); setEditWForm({ amount: String(w.amount), currency: w.currency, note: w.note || '', employee_id: w.employee_id }) }} onDelete={setDeleteWithdrawal} />
                )}
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
                    if (!res.ok) showToast(false, d.error || 'فشل'); else showToast(true, 'تم حفظ أسعار الصرف')
                  } catch { showToast(false, 'خطأ اتصال') }
                  setPanelBusy(false)
                }}>حفظ</button>
              </div>
            )}
            {panelTab === 'account' && (
              <div className="space-y-3">
                <div><label className="label">اسم الموقع</label><input className="input-field" value={cafeName} onChange={(e) => setCafeName(e.target.value)} style={{ textAlign: 'right' }} /><button className="btn-dark w-full mt-2 text-sm" onClick={async () => { const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_cafe_name', cafe_name: cafeName }) }); const d = await res.json(); if (res.ok) { setSiteTitle(cafeName.trim() || siteTitle); showToast(true, 'تم') } else showToast(false, d.error) }}>حفظ الاسم</button></div>
              </div>
            )}
            <button onClick={() => setPanelOpen(false)} className="btn-dark w-full mt-4">إغلاق اللوحة</button>
          </div>
        </div>
      )}

      {showQrScan && <QrScanner busy={qrBusy} onClose={() => setShowQrScan(false)} onScan={handleQrScan} />}
      {showQrEmp && (
        <div className="modal-backdrop" style={{ zIndex: 86 }} onClick={() => setShowQrEmp(null)}>
          <div className="modal-panel" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-3 font-black text-center" style={{ color: 'var(--gold2)' }}>QR — {showQrEmp.full_name}</h3>
            <EmployeeQrCard employeeId={showQrEmp.id} name={showQrEmp.full_name} size={200} />
            <button type="button" className="btn-dark w-full mt-3" onClick={() => setShowQrEmp(null)}>إغلاق</button>
          </div>
        </div>
      )}
      {deleteWithdrawal && (
        <div className="modal-backdrop" style={{ zIndex: 89 }} onClick={() => setDeleteWithdrawal(null)}>
          <div className="modal-panel" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-2 font-black text-center" style={{ color: 'var(--gold2)' }}>حذف سحب</h3>
            <p className="text-sm text-center m-0 mb-5" style={{ color: '#c8d0d6' }}>هل تريد حذف هذا السحب؟</p>
            <div className="flex gap-2">
              <button type="button" className="btn-danger flex-1" onClick={async () => {
                const res = await fetch(`/api/withdrawals/${deleteWithdrawal.id}`, { method: 'DELETE' })
                if (res.ok) { showToast(true, 'تم الحذف'); setDeleteWithdrawal(null); load() } else showToast(false, 'فشل')
              }}>حذف</button>
              <button type="button" className="btn-dark flex-1" onClick={() => setDeleteWithdrawal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
