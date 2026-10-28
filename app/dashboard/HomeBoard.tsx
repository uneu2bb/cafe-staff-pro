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

type DayInfo = {
  status: string
  check_in_at: string | null
  check_out_at: string | null
  worked_minutes: number | null
}

type DayRow = {
  work_date: string
  status: string
  check_in_at: string | null
  check_out_at: string | null
  worked_minutes: number | null
  net_worked_minutes: number | null
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('ar-SY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function minsLabel(m: number | null | undefined) {
  if (m == null || m === 0) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}:${String(min).padStart(2, '0')}`
}

function statusMeta(s: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    none: { label: 'لم يسجل', color: '#a1a1aa', bg: 'rgba(113,113,122,0.15)' },
    present: { label: 'حاضر', color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)' },
    late: { label: 'متأخر', color: '#fcd34d', bg: 'rgba(245,158,11,0.15)' },
    absent: { label: 'غائب', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)' },
    checked_out: { label: 'منصرف', color: '#93c5fd', bg: 'rgba(59,130,246,0.15)' },
    incomplete: { label: 'غير مكتمل', color: '#fdba74', bg: 'rgba(249,115,22,0.15)' },
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
  const [reportRows, setReportRows] = useState<DayRow[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  // شعار: 5 ضغطات خلال ثانيتين → لوحة مخفية
  const logoClicks = useRef<{ n: number; t: number }>({ n: 0, t: 0 })
  const [showPanelGate, setShowPanelGate] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelPwd, setPanelPwd] = useState('')
  const [panelTab, setPanelTab] = useState<'account' | 'rates' | 'withdrawals'>('account')
  const [panelBusy, setPanelBusy] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newAccPwd, setNewAccPwd] = useState('')
  const [newPanelPwd, setNewPanelPwd] = useState('')
  const [rateSyp, setRateSyp] = useState('15000')
  const [rateTry, setRateTry] = useState('34')
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [wTotals, setWTotals] = useState({ USD: 0, SYP: 0, TRY: 0, total_usd: 0 })
  const [wForm, setWForm] = useState({ employee_id: '', amount: '', currency: 'USD', note: '' })

  const [form, setForm] = useState({
    full_name: '', employee_number: '', salary_amount: '', hire_date: '',
    work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000',
  })
  const [saving, setSaving] = useState(false)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل التحميل')
      setEmployees(data.employees || [])

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

  const onLogoClick = () => {
    const now = Date.now()
    if (now - logoClicks.current.t > 2000) logoClicks.current = { n: 0, t: now }
    logoClicks.current.n += 1
    logoClicks.current.t = now
    if (logoClicks.current.n >= 5) {
      logoClicks.current.n = 0
      setShowPanelGate(true)
      setPanelPwd('')
    }
  }

  const verifyPanel = async () => {
    setPanelBusy(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_panel', password: panelPwd }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, data.error || 'فشل')
      } else {
        setShowPanelGate(false)
        setPanelOpen(true)
        // تحميل الإعدادات والسحوبات
        const s = await fetch('/api/admin/settings').then((r) => r.json())
        setNewEmail(s.email || '')
        setRateSyp(s.rate_syp_per_usd || '15000')
        setRateTry(s.rate_try_per_usd || '34')
        loadWithdrawals()
      }
    } catch {
      showToast(false, 'خطأ اتصال')
    }
    setPanelBusy(false)
  }

  const loadWithdrawals = async () => {
    try {
      const res = await fetch('/api/withdrawals')
      const data = await res.json()
      if (data.need_migration) {
        showToast(false, 'نفّذ SQL السحوبات في Supabase أولاً')
        return
      }
      setWithdrawals(data.withdrawals || [])
      if (data.totals) setWTotals(data.totals)
      if (data.rates) {
        setRateSyp(String(data.rates.SYP))
        setRateTry(String(data.rates.TRY))
      }
    } catch {
      /* ignore */
    }
  }

  const openReport = async (emp: Employee, month = reportMonth) => {
    setSelected(emp)
    setReportLoading(true)
    setReportRows([])
    try {
      const [y, m] = month.split('-').map(Number)
      const from = `${month}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const to = `${month}-${String(lastDay).padStart(2, '0')}`
      const supabase = createClient()
      const { data } = await supabase
        .from('daily_attendance')
        .select('work_date, status, check_in_at, check_out_at, worked_minutes, net_worked_minutes')
        .eq('employee_id', emp.id)
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date', { ascending: false })
      setReportRows((data || []) as DayRow[])
    } catch {
      showToast(false, 'فشل تحميل التقرير')
    }
    setReportLoading(false)
  }

  const reportStats = useMemo(() => {
    if (!selected) return null
    const hoursPerDay = Number(selected.work_hours_per_day) || 8
    const monthlySalary = Number(selected.salary_amount) || 0
    const [y, m] = reportMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    let expectedWorkDays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(y, m - 1, d).getDay()
      if (wd !== 5 && wd !== 6) expectedWorkDays++
    }
    if (expectedWorkDays < 1) expectedWorkDays = 26
    const monthlyHours = expectedWorkDays * hoursPerDay
    const hourlyRate = monthlyHours > 0 ? monthlySalary / monthlyHours : 0
    let presentDays = 0, absentDays = 0, incompleteDays = 0, totalMinutes = 0
    for (const r of reportRows) {
      const mins = r.net_worked_minutes ?? r.worked_minutes ?? 0
      if (r.status === 'absent') absentDays++
      else if (r.check_in_at && r.check_out_at) { presentDays++; totalMinutes += mins }
      else if (r.check_in_at && !r.check_out_at) { incompleteDays++; totalMinutes += mins }
      else if (r.status === 'present' || r.status === 'late') { presentDays++; totalMinutes += mins }
    }
    const totalHours = totalMinutes / 60
    const dayRate = monthlySalary / expectedWorkDays
    return {
      presentDays, absentDays, incompleteDays, totalHours, hourlyRate, monthlySalary,
      expectedWorkDays, earnedByHours: totalHours * hourlyRate,
      fixedWithDeductions: Math.max(0, monthlySalary - absentDays * dayRate), dayRate,
    }
  }, [selected, reportRows, reportMonth])

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
    const list = employees.filter((e) => e.status === 'active')
    if (!q) return list
    return list.filter((e) => e.full_name.includes(q) || e.employee_number.includes(q))
  }, [employees, search])

  const doAction = async (employeeId: string, action: 'check_in' | 'check_out' | 'absent') => {
    if (busyId) return
    setBusyId(employeeId)
    const nowIso = new Date().toISOString()

    // تحديث فوري للواجهة (optimistic)
    setTodayMap((prev) => {
      const cur = { ...(prev[employeeId] || { status: 'none', check_in_at: null, check_out_at: null, worked_minutes: null }) }
      if (action === 'check_in') {
        cur.status = 'present'
        cur.check_in_at = nowIso
      } else if (action === 'check_out') {
        cur.status = 'checked_out'
        cur.check_out_at = nowIso
      } else {
        cur.status = 'absent'
      }
      return { ...prev, [employeeId]: cur }
    })
    showToast(true, action === 'check_in' ? 'تم الحضور' : action === 'check_out' ? 'تم الانصراف' : 'تم الغياب')

    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, action }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشلت العملية')
        load() // رجوع للحالة الحقيقية
      }
    } catch {
      showToast(false, 'خطأ في الاتصال')
      load()
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
        body: JSON.stringify({ ...form, salary_amount: Number(form.salary_amount) || 0, work_hours_per_day: Number(form.work_hours_per_day) || 8 }),
      })
      const data = await res.json()
      if (!res.ok) showToast(false, data.error || 'فشل')
      else {
        showToast(true, 'تم إضافة الموظف')
        setShowAdd(false)
        setForm({ full_name: '', employee_number: '', salary_amount: '', hire_date: '', work_hours_per_day: '8', job_title: '', notes: '', pin_code: '0000' })
        load()
      }
    } catch {
      showToast(false, 'خطأ اتصال')
    }
    setSaving(false)
  }

  const logout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0f0c 0%, #0a0a0a 40%, #12100a 100%)' }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl" style={{ background: toast.ok ? 'rgba(16,185,129,0.95)' : 'rgba(220,38,38,0.95)', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-zinc-800/80" style={{ background: 'rgba(10,12,11,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onLogoClick} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #059669, #d97706)', border: 'none', cursor: 'pointer' }}>
              <span className="text-lg">☕</span>
            </button>
            <div>
              <h1 className="font-bold text-white text-base">Cafe Staff Pro</h1>
              <p className="text-xs text-zinc-500">{adminName} · {adminRole === 'owner' ? 'المالك' : 'مدير'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2">+ موظف</button>
            <button onClick={logout} className="text-sm text-red-400 px-3 py-2 rounded-xl">خروج</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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

        <div className="flex gap-3">
          <input className="input-field" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ textAlign: 'right' }} />
          <button onClick={() => { setLoading(true); load() }} className="btn-secondary shrink-0">تحديث</button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-zinc-500">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((emp) => {
              const day = todayMap[emp.id]
              const st = statusMeta(day?.status || 'none')
              return (
                <div key={emp.id} className="card glass employee-card">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <button onClick={() => openReport(emp)} className="text-right flex-1" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <h3 className="font-bold text-white text-lg">{emp.full_name}</h3>
                      <p className="text-xs text-zinc-500">#{emp.employee_number}</p>
                    </button>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mb-4">
                    <div>الراتب: <span className="text-amber-400">${Number(emp.salary_amount || 0).toFixed(0)}</span></div>
                    <div>دخول: <span className="text-emerald-400" dir="ltr">{fmtTime(day?.check_in_at || null)}</span></div>
                    <div>ساعات/يوم: {emp.work_hours_per_day || 8}</div>
                    <div>خروج: <span className="text-red-400" dir="ltr">{fmtTime(day?.check_out_at || null)}</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button disabled={!!busyId} onClick={() => doAction(emp.id, 'check_in')} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#059669' }}>حضور</button>
                    <button disabled={!!busyId} onClick={() => doAction(emp.id, 'absent')} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#b45309' }}>غياب</button>
                    <button disabled={!!busyId} onClick={() => doAction(emp.id, 'check_out')} className="py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#dc2626' }}>انصراف</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Add employee */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">إضافة موظف</h2>
            <form onSubmit={addEmployee} className="space-y-3">
              <div><label className="label">الاسم *</label><input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ textAlign: 'right' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">الرقم الوظيفي *</label><input className="input-field" required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} dir="ltr" /></div>
                <div><label className="label">الراتب $</label><input className="input-field" type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} dir="ltr" /></div>
              </div>
              <div className="flex gap-2"><button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? '...' : 'حفظ'}</button><button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">إلغاء</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Report modal */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">{selected.full_name}</h2>
            <p className="text-sm text-zinc-500 mb-3">#{selected.employee_number} · ${Number(selected.salary_amount || 0).toFixed(0)}</p>
            <input type="month" className="input-field mb-3" value={reportMonth} dir="ltr" onChange={(e) => { setReportMonth(e.target.value); openReport(selected, e.target.value) }} />
            {reportLoading ? <p className="text-center text-zinc-500 py-6">...</p> : reportStats && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">أيام الدوام</p><p className="text-xl font-bold text-emerald-400">{reportStats.presentDays}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">أيام الغياب</p><p className="text-xl font-bold text-red-400">{reportStats.absentDays}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">ساعات العمل</p><p className="text-xl font-bold text-amber-400">{reportStats.totalHours.toFixed(1)}</p></div>
                  <div className="card" style={{ padding: 12 }}><p className="text-xs text-zinc-500">غير مكتمل</p><p className="text-xl font-bold text-orange-400">{reportStats.incompleteDays}</p></div>
                </div>
                <div className="card mb-3" style={{ padding: 12 }}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-zinc-400">حسب الساعات</span><span className="text-emerald-400 font-bold">${reportStats.earnedByHours.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">ثابت − غياب</span><span className="text-amber-400 font-bold">${reportStats.fixedWithDeductions.toFixed(2)}</span></div>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                  {reportRows.map((r) => (
                    <div key={r.work_date} className="flex gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: '#09090b' }}>
                      <span className="text-zinc-300 w-16">{fmtDate(r.work_date)}</span>
                      <span className="text-emerald-400" dir="ltr">{fmtTime(r.check_in_at)}</span>
                      <span className="text-red-400" dir="ltr">{fmtTime(r.check_out_at)}</span>
                      <span className="text-zinc-400 mr-auto" dir="ltr">{minsLabel(r.net_worked_minutes ?? r.worked_minutes)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setSelected(null)} className="btn-secondary w-full">إغلاق</button>
          </div>
        </div>
      )}

      {/* Panel password gate */}
      {showPanelGate && (
        <div className="modal-backdrop" onClick={() => setShowPanelGate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">لوحة التحكم</h2>
            <p className="text-xs text-zinc-500 mb-4">أدخل كلمة مرور اللوحة (الافتراضية: 0000)</p>
            <input type="password" className="input-field mb-3" value={panelPwd} onChange={(e) => setPanelPwd(e.target.value)} dir="ltr" placeholder="••••" />
            <button disabled={panelBusy} onClick={verifyPanel} className="btn-primary w-full">{panelBusy ? '...' : 'دخول'}</button>
          </div>
        </div>
      )}

      {/* Hidden admin panel */}
      {panelOpen && (
        <div className="modal-backdrop" onClick={() => setPanelOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-3">لوحة التحكم المخفية</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
              {([['account', 'الحساب'], ['rates', 'أسعار الصرف'], ['withdrawals', 'السحوبات']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id)} className="px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: panelTab === id ? 'rgba(5,150,105,0.25)' : '#27272a', color: panelTab === id ? '#6ee7b7' : '#a1a1aa', border: 'none' }}>{label}</button>
              ))}
            </div>

            {panelTab === 'account' && (
              <div className="space-y-3">
                <div>
                  <label className="label">تغيير البريد</label>
                  <input className="input-field" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} />
                  <button className="btn-secondary w-full mt-2 text-sm" disabled={panelBusy} onClick={async () => {
                    setPanelBusy(true)
                    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_email', email: newEmail }) })
                    const d = await res.json()
                    showToast(res.ok, res.ok ? 'تم تحديث البريد' : d.error)
                    setPanelBusy(false)
                  }}>حفظ البريد</button>
                </div>
                <div>
                  <label className="label">كلمة مرور الحساب الجديدة</label>
                  <input type="password" className="input-field" value={newAccPwd} onChange={(e) => setNewAccPwd(e.target.value)} dir="ltr" />
                  <button className="btn-secondary w-full mt-2 text-sm" disabled={panelBusy} onClick={async () => {
                    setPanelBusy(true)
                    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_account_password', password: newAccPwd }) })
                    const d = await res.json()
                    showToast(res.ok, res.ok ? 'تم تغيير كلمة المرور' : d.error)
                    setPanelBusy(false)
                  }}>حفظ كلمة مرور الحساب</button>
                </div>
                <div>
                  <label className="label">كلمة مرور لوحة التحكم</label>
                  <input type="password" className="input-field" value={newPanelPwd} onChange={(e) => setNewPanelPwd(e.target.value)} dir="ltr" placeholder="0000" />
                  <button className="btn-secondary w-full mt-2 text-sm" disabled={panelBusy} onClick={async () => {
                    setPanelBusy(true)
                    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_panel_password', password: newPanelPwd }) })
                    const d = await res.json()
                    showToast(res.ok, res.ok ? 'تم تغيير كلمة اللوحة' : d.error)
                    setPanelBusy(false)
                  }}>حفظ كلمة اللوحة</button>
                </div>
              </div>
            )}

            {panelTab === 'rates' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">كم وحدة من العملة مقابل <strong className="text-amber-400">1 دولار</strong></p>
                <div>
                  <label className="label">ليرة سورية (SYP) لكل 1 USD</label>
                  <input className="input-field" type="number" value={rateSyp} onChange={(e) => setRateSyp(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="label">ليرة تركية (TRY) لكل 1 USD</label>
                  <input className="input-field" type="number" value={rateTry} onChange={(e) => setRateTry(e.target.value)} dir="ltr" />
                </div>
                <button className="btn-primary w-full" disabled={panelBusy} onClick={async () => {
                  setPanelBusy(true)
                  const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_rates', rate_syp_per_usd: rateSyp, rate_try_per_usd: rateTry }) })
                  showToast(res.ok, res.ok ? 'تم حفظ الأسعار' : 'فشل')
                  setPanelBusy(false)
                }}>حفظ أسعار الصرف</button>
              </div>
            )}

            {panelTab === 'withdrawals' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="card" style={{ padding: 10 }}><p className="text-xs text-zinc-500">USD</p><p className="font-bold text-emerald-400">${wTotals.USD.toFixed(2)}</p></div>
                  <div className="card" style={{ padding: 10 }}><p className="text-xs text-zinc-500">SYP</p><p className="font-bold text-amber-400">{wTotals.SYP.toFixed(0)}</p></div>
                  <div className="card" style={{ padding: 10 }}><p className="text-xs text-zinc-500">TRY</p><p className="font-bold text-red-400">{wTotals.TRY.toFixed(0)}</p></div>
                  <div className="card" style={{ padding: 10 }}><p className="text-xs text-zinc-500">الإجمالي USD</p><p className="font-bold text-white">${wTotals.total_usd.toFixed(2)}</p></div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <p className="text-xs text-zinc-500 mb-2">إضافة سحب</p>
                  <select className="input-field mb-2" value={wForm.employee_id} onChange={(e) => setWForm({ ...wForm, employee_id: e.target.value })} style={{ textAlign: 'right' }}>
                    <option value="">اختر موظف</option>
                    {employees.filter((e) => e.status === 'active').map((e) => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="input-field" type="number" placeholder="المبلغ" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} dir="ltr" />
                    <select className="input-field" value={wForm.currency} onChange={(e) => setWForm({ ...wForm, currency: e.target.value })}>
                      <option value="USD">دولار USD</option>
                      <option value="SYP">سوري SYP</option>
                      <option value="TRY">تركي TRY</option>
                    </select>
                  </div>
                  <input className="input-field mb-2" placeholder="ملاحظة" value={wForm.note} onChange={(e) => setWForm({ ...wForm, note: e.target.value })} style={{ textAlign: 'right' }} />
                  <button className="btn-primary w-full text-sm" disabled={panelBusy} onClick={async () => {
                    setPanelBusy(true)
                    const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wForm) })
                    const d = await res.json()
                    if (!res.ok) showToast(false, d.error || 'فشل')
                    else { showToast(true, 'تم تسجيل السحب'); setWForm({ employee_id: '', amount: '', currency: 'USD', note: '' }); loadWithdrawals() }
                    setPanelBusy(false)
                  }}>تسجيل السحب</button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="text-xs flex justify-between px-2 py-1.5 rounded-lg" style={{ background: '#09090b' }}>
                      <span className="text-zinc-300">{w.profiles?.full_name || '—'}</span>
                      <span className="text-amber-400">{w.amount} {w.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setPanelOpen(false)} className="btn-secondary w-full mt-4">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
