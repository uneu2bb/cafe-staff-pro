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
    t = t.replace(
      "'use client'\n",
      "'use client'\n\nimport DeleteMonthRecords from './DeleteMonthRecords'\n"
    )
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
  if (t.includes(needle)) {
    t = t.replace(needle, inject)
  } else {
    console.warn('HomeBoard: could not find delete employee button to inject month-delete UI')
  }
}

fs.writeFileSync(path.join(dir, 'HomeBoard.tsx'), t)
console.log('HomeBoard joined', t.length, t.includes('DeleteMonthRecords') ? '+DeleteMonthRecords' : '')
