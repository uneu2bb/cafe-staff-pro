'use client'

import { useMemo, useState } from 'react'

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

function lastMonths(count = 12) {
  const out: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    out.push({ key: key, label: AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear() })
  }
  return out
}

export default function DeleteMonthRecords(props: {
  employeeId: string
  employeeName: string
  onDone?: () => void
  onToast: (ok: boolean, msg: string) => void
}) {
  const employeeId = props.employeeId
  const employeeName = props.employeeName
  const onDone = props.onDone
  const onToast = props.onToast

  const months = useMemo(function () { return lastMonths(12) }, [])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  function toggle(key: string) {
    setSelected(function (prev) {
      return prev.indexOf(key) >= 0 ? prev.filter(function (k) { return k !== key }) : prev.concat([key])
    })
  }

  async function runDelete() {
    if (!selected.length) {
      onToast(false, 'اختر شهراً واحداً على الأقل')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/employees/' + employeeId + '/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: selected }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        onToast(false, data.error || 'فشل الحذف')
      } else {
        onToast(true, data.message || 'تم حذف السجلات')
        setSelected([])
        setConfirm(false)
        if (onDone) onDone()
      }
    } catch (e) {
      onToast(false, 'خطأ اتصال')
    }
    setBusy(false)
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(214,163,75,.2)' }}>
      <p className="m-0 mb-1 text-xs font-bold" style={{ color: 'var(--gold2)' }}>
        حذف سجلات حضور — {employeeName}
      </p>
      <p className="m-0 mb-2 text-[11px]" style={{ color: 'var(--muted)' }}>
        اختر من آخر 12 شهر لمسح حضور وانصراف هذا الموظف فقط.
      </p>
      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto mb-2" style={{ direction: 'rtl' }}>
        {months.map(function (m) {
          const on = selected.indexOf(m.key) >= 0
          return (
            <button
              key={m.key}
              type="button"
              onClick={function () { if (!busy) toggle(m.key) }}
              className="text-xs px-2 py-1.5 rounded-lg text-right"
              style={{
                background: on ? 'rgba(214,163,75,.18)' : '#111920',
                border: on ? '1px solid var(--gold2)' : '1px solid rgba(180,190,200,.12)',
                color: on ? 'var(--gold2)' : '#c8d0d6',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {(on ? '✓ ' : '') + m.label}
            </button>
          )
        })}
      </div>
      {!confirm ? (
        <button
          type="button"
          disabled={!selected.length || busy}
          onClick={function () { setConfirm(true) }}
          className="btn-danger w-full text-sm"
        >
          {selected.length ? ('حذف سجلات ' + selected.length + ' شهر') : 'اختر أشهراً للحذف'}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="m-0 text-xs text-center" style={{ color: '#ffb4b8' }}>
            تأكيد حذف حضور وانصراف الأشهر المحددة لهذا الموظف (لا يمكن التراجع).
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={runDelete} className="btn-danger flex-1">
              {busy ? 'جاري الحذف...' : 'تأكيد الحذف'}
            </button>
            <button type="button" disabled={busy} onClick={function () { setConfirm(false) }} className="btn-dark flex-1">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
