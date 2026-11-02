const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const root = path.join(__dirname, '..')
const dir = path.join(root, 'app/dashboard')

function loadParts(prefix) {
  let i = 0
  let out = ''
  while (true) {
    const f = path.join(dir, `${prefix}-${i}.b64`)
    if (!fs.existsSync(f)) break
    out += fs.readFileSync(f, 'utf8').trim()
    i++
  }
  if (!out) throw new Error('missing parts for ' + prefix)
  return zlib.gunzipSync(Buffer.from(out, 'base64')).toString('utf8')
}

let a = loadParts('hb-a')
let b = loadParts('hb-b')
let t = a + b

if (!t.includes('DeleteMonthRecords')) {
  if (t.includes("import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'")) {
    t = t.replace(
      "import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'",
      "import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'\nimport DeleteMonthRecords from './DeleteMonthRecords'"
    )
  } else {
    t = t.replace("'use client'\n", "'use client'\n\nimport DeleteMonthRecords from './DeleteMonthRecords'\n")
  }
  const needle = '<button onClick={() => requestDelete(editEmp)} className="w-full btn-danger">حذف الموظف</button>'
  const inject = `{editEmp && (
                <DeleteMonthRecords
                  employeeId={editEmp.id}
                  employeeName={editEmp.full_name}
                  onToast={showToast}
                  onDone={() => { void load() }}
                />
              )}
              <button onClick={() => requestDelete(editEmp)} className="w-full btn-danger">حذف الموظف</button>`
  if (t.includes(needle)) t = t.replace(needle, inject)
}

if (!t.includes('FancyTimePicker')) {
  if (t.includes("import DeleteMonthRecords from './DeleteMonthRecords'")) {
    t = t.replace("import DeleteMonthRecords from './DeleteMonthRecords'", "import DeleteMonthRecords from './DeleteMonthRecords'\nimport FancyTimePicker from './FancyTimePicker'")
  } else {
    t = t.replace("'use client'\n", "'use client'\n\nimport FancyTimePicker from './FancyTimePicker'\n")
  }
}

if (!t.includes('auto_checkout_time')) {
  t = t.replace(
    'type Employee = { id: string; full_name: string; employee_number: string; salary_amount: number; work_hours_per_day: number; status: string; job_title: string | null; phone: string | null; pin_code: string | null; hire_date: string | null; notes: string | null }',
    'type Employee = { id: string; full_name: string; employee_number: string; salary_amount: number; work_hours_per_day: number; status: string; job_title: string | null; phone: string | null; pin_code: string | null; hire_date: string | null; notes: string | null; auto_checkout_time?: string | null }'
  )
  t = t.replace(
    "const [editForm, setEditForm] = useState({ full_name: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', pin_code: '', notes: '' })",
    "const [editForm, setEditForm] = useState({ full_name: '', salary_amount: '', work_hours_per_day: '8', job_title: '', phone: '', pin_code: '', notes: '', auto_checkout_time: '' })"
  )
  t = t.replace(
    "const openEdit = (emp: Employee) => { setEditEmp(emp); setEditForm({ full_name: emp.full_name, salary_amount: String(emp.salary_amount || 0), work_hours_per_day: String(emp.work_hours_per_day || 8), job_title: emp.job_title || '', phone: emp.phone || '', pin_code: emp.pin_code || '', notes: emp.notes || '' }) }",
    "const openEdit = (emp: Employee) => { setEditEmp(emp); setEditForm({ full_name: emp.full_name, salary_amount: String(emp.salary_amount || 0), work_hours_per_day: String(emp.work_hours_per_day || 8), job_title: emp.job_title || '', phone: emp.phone || '', pin_code: emp.pin_code || '', notes: emp.notes || '', auto_checkout_time: emp.auto_checkout_time || '' }) }"
  )
  t = t.replace(
    'body: JSON.stringify({ full_name: editForm.full_name, salary_amount: Number(editForm.salary_amount) || 0, work_hours_per_day: Number(editForm.work_hours_per_day) || 8, job_title: editForm.job_title || null, phone: editForm.phone || null, pin_code: editForm.pin_code || null, notes: editForm.notes || null })',
    'body: JSON.stringify({ full_name: editForm.full_name, salary_amount: Number(editForm.salary_amount) || 0, work_hours_per_day: Number(editForm.work_hours_per_day) || 8, job_title: editForm.job_title || null, phone: editForm.phone || null, pin_code: editForm.pin_code || null, notes: editForm.notes || null, auto_checkout_time: editForm.auto_checkout_time || null })'
  )
}

{
  const fancyBlock = '<FancyTimePicker value={editForm.auto_checkout_time || \'\'} onChange={(v) => setEditForm({ ...editForm, auto_checkout_time: v })} label="انصراف تلقائي (إيقاف وحفظ)" />'
  if (!t.includes('FancyTimePicker value={editForm.auto_checkout_time')) {
    const phoneField = '<div><label className="label">واتساب / هاتف دولي</label><input className="input-field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} dir="ltr" placeholder="+90 5xx xxx xxxx" style={{ textAlign: \'left\' }} /></div>'
    if (t.includes(phoneField)) t = t.replace(phoneField, phoneField + '\n              ' + fancyBlock)
  }
}

if (!t.includes('ONLINE_SESSION_SYNC')) {
  t = t.replace("'use client'", "'use client'\n/* ONLINE_SESSION_SYNC */")
  const oldStart = `const startSession = (empId: string) => {
    const day = todayMap[empId]
    if (day?.check_in_at && day?.check_out_at) { showToast(false, 'تم حفظ دوام هذا الموظف اليوم'); return }
    if (sessions[empId]?.running) return
    setSessions((prev) => ({ ...prev, [empId]: { startMs: Date.now(), endMs: null, running: true } }))
    showToast(true, 'بدأت الساعة')
  }`
  const newStart = `const startSession = async (empId: string) => {
    const day = todayMap[empId]
    if (day?.check_in_at && day?.check_out_at) { showToast(false, 'تم حفظ دوام هذا الموظف اليوم'); return }
    if (sessions[empId]?.running) return
    setBusyId(empId)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId, action: 'check_in', method: 'manual' }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشل تسجيل الحضور')
      } else {
        const startMs = data.check_in_at ? new Date(data.check_in_at).getTime() : Date.now()
        setSessions((prev) => ({ ...prev, [empId]: { startMs, endMs: null, running: true } }))
        setTodayMap((prev) => ({ ...prev, [empId]: { status: 'present', check_in_at: data.check_in_at, check_out_at: null, worked_minutes: null } }))
        showToast(true, data.already ? 'استئناف الحضور من السحابة' : 'بدأت الساعة (محفوظ أونلاين)')
      }
    } catch { showToast(false, 'خطأ اتصال — لم يُحفظ أونلاين') }
    setBusyId(null)
  }`
  if (t.includes(oldStart)) t = t.replace(oldStart, newStart)

  const mapEnd = 'setTodayMap(map)\n      if (wrRes.ok) setWithdrawals(wrRes.data.withdrawals || [])'
  const mapEndOnline = `setTodayMap(map)
      setSessions((prev) => {
        const next: Record<string, Session> = { ...prev }
        for (const [empId, d] of Object.entries(map) as [string, DayInfo][]) {
          if (d.check_in_at && !d.check_out_at) {
            const startMs = new Date(d.check_in_at).getTime()
            const existing = next[empId]
            if (!(existing && !existing.running && existing.endMs)) next[empId] = { startMs, endMs: null, running: true }
          } else if (d.check_in_at && d.check_out_at) {
            delete next[empId]
          }
        }
        return next
      })
      if (wrRes.ok) setWithdrawals(wrRes.data.withdrawals || [])`
  if (t.includes(mapEnd)) t = t.replace(mapEnd, mapEndOnline)

  if (!t.includes('focus online reload')) {
    const afterLoadEffect = 'useEffect(() => { load() }, [load])'
    const withFocus = `useEffect(() => { load() }, [load])
  // focus online reload
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    const onFocus = () => { void load() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    const poll = setInterval(() => { void load() }, 8000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
  }, [load])`
    if (t.includes(afterLoadEffect)) t = t.replace(afterLoadEffect, withFocus)
  }
}

if (!t.includes('REALTIME_INSTANT_SYNC')) {
  t = t.replace('const poll = setInterval(() => { void load() }, 30000)', 'const poll = setInterval(() => { void load() }, 8000)')
  const realtimeBlock = `
  // REALTIME_INSTANT_SYNC
  useEffect(() => {
    const supabase = createClient()
    const applyDayRow = (row: any) => {
      if (!row || !row.employee_id) return
      const today = new Date().toISOString().slice(0, 10)
      if (row.work_date && String(row.work_date).slice(0, 10) !== today) return
      let status = row.status || 'none'
      if (row.check_in_at && row.check_out_at) status = 'checked_out'
      else if (row.check_in_at) status = 'present'
      setTodayMap((prev) => ({ ...prev, [row.employee_id]: { status, check_in_at: row.check_in_at, check_out_at: row.check_out_at, worked_minutes: row.worked_minutes } }))
      setSessions((prev) => {
        const next = { ...prev }
        if (row.check_in_at && !row.check_out_at) {
          const startMs = new Date(row.check_in_at).getTime()
          const existing = next[row.employee_id]
          if (!(existing && !existing.running && existing.endMs)) next[row.employee_id] = { startMs, endMs: null, running: true }
        } else if (row.check_in_at && row.check_out_at) {
          delete next[row.employee_id]
        }
        return next
      })
    }
    const channel = supabase.channel('live-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance' }, (payload: any) => {
        applyDayRow(payload.new || payload.old)
        if (payload.eventType === 'DELETE' && payload.old?.employee_id) {
          setTodayMap((prev) => { const n = { ...prev }; delete n[payload.old.employee_id]; return n })
          setSessions((prev) => { const n = { ...prev }; delete n[payload.old.employee_id]; return n })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_withdrawals' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])
`
  if (t.includes('focus online reload')) {
    const focusEnd = `clearInterval(poll)
    }
  }, [load])`
    if (t.includes(focusEnd) && !t.includes('REALTIME_INSTANT_SYNC')) t = t.replace(focusEnd, focusEnd + realtimeBlock)
  } else if (t.includes('useEffect(() => { load() }, [load])') && !t.includes('REALTIME_INSTANT_SYNC')) {
    t = t.replace('useEffect(() => { load() }, [load])', 'useEffect(() => { load() }, [load])' + realtimeBlock)
  }
}

if (!t.includes('STOP_SAVES_ONLINE')) {
  t = t.replace("'use client'", "'use client'\n/* STOP_SAVES_ONLINE */")
  const oldStop = `const stopSession = (empId: string) => {
    const s = sessions[empId]
    if (!s?.running) { showToast(false, 'اضغط حضور أولاً'); return }
    setSessions((prev) => ({ ...prev, [empId]: { ...prev[empId], endMs: Date.now(), running: false } }))
    showToast(true, 'توقفت الساعة — اضغط حفظ')
  }`
  const newStop = `const stopSession = async (empId: string) => {
    const s = sessions[empId]
    if (!s?.running) { showToast(false, 'اضغط حضور أولاً'); return }
    if (busyId) return
    const endMs = Date.now()
    setSessions((prev) => ({ ...prev, [empId]: { ...prev[empId], endMs, running: false } }))
    setBusyId(empId)
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          action: 'save_session',
          check_in_at: new Date(s.startMs).toISOString(),
          check_out_at: new Date(endMs).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        showToast(false, data.error || 'فشل الانصراف')
      } else {
        showToast(true, data.message || 'تم الانصراف والحفظ')
        setSessions((prev) => { const n = { ...prev }; delete n[empId]; return n })
        setTodayMap((prev) => ({ ...prev, [empId]: { status: 'checked_out', check_in_at: data.check_in_at, check_out_at: data.check_out_at, worked_minutes: data.worked_minutes } }))
      }
    } catch { showToast(false, 'خطأ اتصال') }
    setBusyId(null)
  }`
  if (t.includes(oldStop)) t = t.replace(oldStop, newStop)
}

// --- PERF: light attendance refresh + debounced focus + less aggressive poll ---
if (!t.includes('PERF_LIGHT_REFRESH')) {
  t = t.replace("'use client'", "'use client'\n/* PERF_LIGHT_REFRESH */")

  // Guard concurrent full loads
  if (!t.includes('loadInFlightRef')) {
    t = t.replace(
      'const [loading, setLoading] = useState(true)',
      'const [loading, setLoading] = useState(true)\n  const loadInFlightRef = useRef(false)\n  const lastFullLoadRef = useRef(0)'
    )
  }

  // Wrap load body with in-flight guard
  const loadStart = 'const load = useCallback(async () => {\n    try {'
  const loadStartGuarded = `const load = useCallback(async () => {
    if (loadInFlightRef.current) return
    loadInFlightRef.current = true
    lastFullLoadRef.current = Date.now()
    try {`
  if (t.includes(loadStart)) t = t.replace(loadStart, loadStartGuarded)

  const loadEnd = `} catch (e: unknown) { showToast(false, e instanceof Error ? e.message : 'خطأ') }
    setLoading(false)
  }, [])`
  const loadEndGuarded = `} catch (e: unknown) { showToast(false, e instanceof Error ? e.message : 'خطأ') }
    setLoading(false)
    loadInFlightRef.current = false
  }, [])

  // light refresh: attendance only (no employees/withdrawals API)
  const refreshAttendance = useCallback(async () => {
    try {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('daily_attendance')
        .select('employee_id, status, check_in_at, check_out_at, worked_minutes, work_date')
        .eq('work_date', today)
      const map: Record<string, DayInfo> = {}
      for (const d of data || []) {
        let status = d.status || 'none'
        if (d.check_in_at && d.check_out_at) status = 'checked_out'
        else if (d.check_in_at) status = 'present'
        map[d.employee_id] = { status, check_in_at: d.check_in_at, check_out_at: d.check_out_at, worked_minutes: d.worked_minutes }
      }
      setTodayMap(map)
      setSessions((prev) => {
        const next: Record<string, Session> = { ...prev }
        for (const [empId, d] of Object.entries(map) as [string, DayInfo][]) {
          if (d.check_in_at && !d.check_out_at) {
            const startMs = new Date(d.check_in_at).getTime()
            const existing = next[empId]
            if (!(existing && !existing.running && existing.endMs)) next[empId] = { startMs, endMs: null, running: true }
          } else if (d.check_in_at && d.check_out_at) {
            delete next[empId]
          }
        }
        return next
      })
    } catch {}
  }, [])`
  if (t.includes(loadEnd)) t = t.replace(loadEnd, loadEndGuarded)

  // Replace aggressive poll/focus with debounced + light refresh
  const oldPollBlock = `// focus online reload
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    const onFocus = () => { void load() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    const poll = setInterval(() => { void load() }, 8000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
  }, [load])`

  const newPollBlock = `// PERF: debounced focus + light attendance poll (realtime handles instant)
  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | null = null
    const softReload = () => {
      if (focusTimer) clearTimeout(focusTimer)
      focusTimer = setTimeout(() => {
        // full load at most every 20s on focus
        if (Date.now() - lastFullLoadRef.current > 20000) void load()
        else void refreshAttendance()
      }, 400)
    }
    const onVis = () => { if (document.visibilityState === 'visible') softReload() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', softReload)
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshAttendance()
    }, 18000)
    return () => {
      if (focusTimer) clearTimeout(focusTimer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', softReload)
      clearInterval(poll)
    }
  }, [load, refreshAttendance])`

  if (t.includes(oldPollBlock)) {
    t = t.replace(oldPollBlock, newPollBlock)
  } else {
    // try variant with 30000
    const alt = oldPollBlock.replace('8000', '30000')
    if (t.includes(alt)) t = t.replace(alt, newPollBlock)
  }
}

fs.writeFileSync(path.join(dir, 'HomeBoard.tsx'), t)
console.log(
  'HomeBoard joined',
  t.length,
  t.includes('STOP_SAVES_ONLINE') ? '+StopOnline' : '',
  t.includes('REALTIME_INSTANT_SYNC') ? '+Realtime' : '',
  t.includes('PERF_LIGHT_REFRESH') ? '+Perf' : ''
)
