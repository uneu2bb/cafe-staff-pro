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
        setTodayMap((prev) => ({ ...prev, [employeeId]: { status: 'checked_out', check_in_at: data.check_in_at, check_out_at: data.check_out_at, worked_minutes: data.worked_minutes } }))
      }
    } catch {
      showToast(false, 'خطأ اتصال — أعد المحاولة')
      void load()
    }
    setQrBusy(false)
  }, [employees, todayMap, load])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {toast && <div className="fixed bottom-5 left-5 z-[80] px-4 py-3 rounded-xl text-sm font-bold" style={{ background: toast.ok ? '#14241d' : '#2a1418', border: `1px solid ${toast.ok ? '#26865d' : '#d83e4d'}`, color: toast.ok ? '#d6ffea' : '#ffd0d4' }}>{toast.msg}</div>}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4" style={{ height: 64, borderBottom: '1px solid var(--line)', background: 'rgba(8,12,15,.88)' }}>
        <strong style={{ color: 'var(--gold2)' }}>{siteTitle}</strong>
        <div className="flex gap-2">
          <button type="button" className="btn-dark" onClick={() => setShowQrScan(true)}>مسح QR</button>
          <button type="button" className="btn-dark" onClick={async () => { await createClient().auth.signOut(); router.push('/login') }}>خروج</button>
        </div>
      </header>
      <main className="p-4 max-w-5xl mx-auto space-y-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{loading ? 'جاري التحميل...' : `${employees.filter(e=>e.status==='active').length} موظف`}</p>
        <div className="space-y-2">
          {employees.filter(e=>e.status==='active').map((emp) => {
            const day = todayMap[emp.id]
            let st = 'لم يسجل'
            if (day?.check_in_at && day?.check_out_at) st = 'محفوظ'
            else if (day?.check_in_at) st = 'حاضر'
            return (
              <div key={emp.id} className="card flex items-center justify-between gap-2" style={{ padding: 12 }}>
                <div>
                  <p className="m-0 text-white font-bold">{emp.full_name}</p>
                  <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>{st} · {fmtTime(day?.check_in_at || null)} - {fmtTime(day?.check_out_at || null)}</p>
                </div>
                <button type="button" className="btn-dark text-xs" onClick={() => setShowQrEmp(emp)}>QR</button>
              </div>
            )
          })}
        </div>
      </main>
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
    </div>
  )
}
