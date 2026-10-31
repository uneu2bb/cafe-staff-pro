'use client'

type Withdrawal = { id: string; employee_id: string; amount: number; currency: string; note: string | null; withdrawn_at: string }

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function EmployeeWithdrawalFile({
  employeeId,
  employeeName,
  withdrawals,
  onEdit,
  onDelete,
}: {
  employeeId: string
  employeeName: string
  withdrawals: Withdrawal[]
  onEdit: (w: Withdrawal) => void
  onDelete: (w: Withdrawal) => void
}) {
  const list = withdrawals
    .filter((w) => w.employee_id === employeeId)
    .slice()
    .sort((a, b) => new Date(b.withdrawn_at).getTime() - new Date(a.withdrawn_at).getTime())

  const totals: Record<string, number> = {}
  for (const w of list) {
    const c = (w.currency || 'USD').toUpperCase()
    totals[c] = (totals[c] || 0) + (Number(w.amount) || 0)
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(214,163,75,.2)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs m-0 font-bold" style={{ color: 'var(--gold2)' }}>
          ملف سحوبات — {employeeName}
        </p>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{list.length} عملية</span>
      </div>
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(totals).map(([c, total]) => (
            <span key={c} className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ color: 'var(--gold2)', background: 'rgba(214,163,75,.12)', border: '1px solid rgba(214,163,75,.35)' }}>
              {c}: {Number(total).toLocaleString()}
            </span>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto space-y-1.5">
        {list.map((w, idx) => (
          <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.15)' }}>
            <div className="min-w-0 text-right">
              <p className="text-xs text-white m-0 font-bold" dir="ltr">
                #{list.length - idx} · {Number(w.amount).toLocaleString()} {w.currency}
              </p>
              <p className="text-[10px] m-0" style={{ color: 'var(--muted)' }} dir="ltr">
                {fmtTime(w.withdrawn_at)}{w.note ? ` · ${w.note}` : ''}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" className="text-[10px] px-2 py-1 rounded-lg btn-dark" onClick={() => onEdit(w)}>تعديل</button>
              <button type="button" className="text-[10px] px-2 py-1 rounded-lg btn-danger" onClick={() => onDelete(w)}>حذف</button>
            </div>
          </div>
        ))}
        {!list.length && (
          <p className="text-xs text-center py-2 m-0" style={{ color: 'var(--muted)' }}>لا توجد سحوبات لهذا الموظف</p>
        )}
      </div>
    </div>
  )
}
