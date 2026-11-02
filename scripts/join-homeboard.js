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

// --- inject DeleteMonthRecords feature ---
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

// --- FancyTimePicker import ---
if (!t.includes('FancyTimePicker')) {
  if (t.includes("import DeleteMonthRecords from './DeleteMonthRecords'")) {
    t = t.replace(
      "import DeleteMonthRecords from './DeleteMonthRecords'",
      "import DeleteMonthRecords from './DeleteMonthRecords'\nimport FancyTimePicker from './FancyTimePicker'"
    )
  } else if (t.includes("import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'")) {
    t = t.replace(
      "import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'",
      "import { EmployeeWithdrawalFile } from './EmployeeWithdrawalFile'\nimport FancyTimePicker from './FancyTimePicker'"
    )
  } else {
    t = t.replace("'use client'\n", "'use client'\n\nimport FancyTimePicker from './FancyTimePicker'\n")
  }
}

// --- inject auto_checkout_time support ---
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

// Replace native time input (or previous inject) with FancyTimePicker
{
  const nativeBlock =
    '<div><label className="label">انصراف تلقائي (وقت الإيقاف والحفظ)</label><input className="input-field" type="time" value={editForm.auto_checkout_time || \'\'} onChange={(e) => setEditForm({ ...editForm, auto_checkout_time: e.target.value })} dir="ltr" /><p className="m-0 mt-1 text-[11px]" style={{ color: \'var(--muted)\' }}>عند حلول هذا الوقت يُوقف التايمر ويُحفظ الدوام تلقائياً إذا كانت الشاشة مفتوحة.</p></div>'

  const fancyBlock =
    '<FancyTimePicker value={editForm.auto_checkout_time || \'\'} onChange={(v) => setEditForm({ ...editForm, auto_checkout_time: v })} label="انصراف تلقائي (إيقاف وحفظ)" />'

  if (t.includes(nativeBlock)) {
    t = t.replace(nativeBlock, fancyBlock)
  } else if (!t.includes('FancyTimePicker value={editForm.auto_checkout_time')) {
    // insert after phone field
    const phoneField =
      '<div><label className="label">واتساب / هاتف دولي</label><input className="input-field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} dir="ltr" placeholder="+90 5xx xxx xxxx" style={{ textAlign: \'left\' }} /></div>'
    if (t.includes(phoneField)) {
      t = t.replace(phoneField, phoneField + '\n              ' + fancyBlock)
    }
  }
}

// Auto checkout effect
if (!t.includes('انصراف تلقائي حسب وقت كل موظف')) {
  const marker = '}, [hasRunningSession])'
  const autoEffect = `}, [hasRunningSession])

  // انصراف تلقائي حسب وقت كل موظف
  const autoSavingRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const tickAuto = async () => {
      const now = new Date()
      for (const emp of employees) {
        const auto = (emp as any).auto_checkout_time as string | null | undefined
        if (!auto || !/^\\d{2}:\\d{2}$/.test(auto)) continue
        const sess = sessions[emp.id]
        if (!sess?.running) continue
        if (autoSavingRef.current[emp.id]) continue
        const [hh, mm] = auto.split(':').map(Number)
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
        if (now.getTime() < target.getTime()) continue
        if (sess.startMs >= target.getTime()) continue
        autoSavingRef.current[emp.id] = true
        const endMs = target.getTime()
        setSessions((prev) => ({ ...prev, [emp.id]: { ...prev[emp.id], endMs, running: false } }))
        try {
          const res = await fetch('/api/attendance/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: emp.id,
              action: 'save_session',
              check_in_at: new Date(sess.startMs).toISOString(),
              check_out_at: new Date(endMs).toISOString(),
            }),
          })
          const data = await res.json()
          if (res.ok && data.success !== false) {
            showToast(true, 'انصراف تلقائي — ' + emp.full_name)
            setSessions((prev) => { const n = { ...prev }; delete n[emp.id]; return n })
            setTodayMap((prev) => ({
              ...prev,
              [emp.id]: {
                status: 'checked_out',
                check_in_at: data.check_in_at,
                check_out_at: data.check_out_at,
                worked_minutes: data.worked_minutes,
              },
            }))
          } else {
            showToast(false, data.error || 'فشل الانصراف التلقائي')
            autoSavingRef.current[emp.id] = false
          }
        } catch {
          showToast(false, 'فشل الانصراف التلقائي')
          autoSavingRef.current[emp.id] = false
        }
      }
    }
    const id = setInterval(() => { void tickAuto() }, 10000)
    void tickAuto()
    return () => clearInterval(id)
  }, [employees, sessions])`

  if (t.includes(marker)) t = t.replace(marker, autoEffect)
}

fs.writeFileSync(path.join(dir, 'HomeBoard.tsx'), t)
console.log(
  'HomeBoard joined',
  t.length,
  t.includes('DeleteMonthRecords') ? '+DeleteMonthRecords' : '',
  t.includes('auto_checkout_time') ? '+autoCheckout' : '',
  t.includes('FancyTimePicker') ? '+FancyTime' : ''
)
