'use client'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('ar-SY', { weekday: 'short', day: 'numeric', month: 'short' })
}
function minsLabel(m: number | null | undefined) {
  if (m == null || m === 0) return '—'
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export default function ReportModal({
  fullReport,
  reportLoading,
  reportMonth,
  setReportMonth,
  generateReport,
  onClose,
}: {
  fullReport: any
  reportLoading: boolean
  reportMonth: string
  setReportMonth: (m: string) => void
  generateReport: (id: string, month?: string) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        {reportLoading ? (
          <p className="text-center text-zinc-500 py-10">...</p>
        ) : fullReport && (
          <>
            <h2 className="text-lg font-bold text-white">{fullReport.employee.full_name}</h2>
            <p className="text-xs text-zinc-500 mb-3">#{fullReport.employee.employee_number} · {fullReport.month}</p>
            <input
              type="month"
              className="input-field mb-3"
              value={reportMonth}
              dir="ltr"
              onChange={(e) => {
                setReportMonth(e.target.value)
                generateReport(fullReport.employee.id, e.target.value)
              }}
            />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-zinc-500">أيام الدوام</p>
                <p className="text-xl font-bold text-emerald-400">{fullReport.stats.presentDays}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-zinc-500">ساعات العمل</p>
                <p className="text-xl font-bold text-amber-400">{Number(fullReport.stats.totalHours).toFixed(2)}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-zinc-500">يطلعله باليوم</p>
                <p className="text-xl font-bold text-sky-400">${Number(fullReport.stats.dayRate).toFixed(2)}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-zinc-500">أجر الساعة</p>
                <p className="text-xl font-bold text-violet-400">${Number(fullReport.stats.hourlyRate).toFixed(2)}</p>
              </div>
            </div>
            <div className="card mb-3" style={{ padding: 14, borderColor: 'rgba(167,139,250,0.4)' }}>
              <p className="text-xs text-zinc-500 mb-2 font-medium">حساب أجر الساعات</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">اليومية ÷ ساعات اليوم ({fullReport.stats.hoursPerDay || 8})</span>
                  <span className="text-violet-400">${Number(fullReport.stats.hourlyRate).toFixed(2)} / ساعة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">ساعات الدوام × أجر الساعة</span>
                  <span className="text-amber-400">{Number(fullReport.stats.totalHours).toFixed(2)} × ${Number(fullReport.stats.hourlyRate).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">إجمالي أجر الساعات</span>
                  <span className="text-white font-bold">
                    ${
                      Number(
                        fullReport.stats.earnedByHours ??
                          Number(fullReport.stats.totalHours) * Number(fullReport.stats.hourlyRate)
                      ).toFixed(2)
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">السحوبات</span>
                  <span className="text-red-400">− ${Number(fullReport.stats.withdrawnUsd).toFixed(2)}</span>
                </div>
                <div className="border-t border-zinc-700 my-2" />
                <div className="flex justify-between">
                  <span className="text-white font-bold">الصافي المستحق</span>
                  <span className="text-emerald-400 font-bold text-lg">${Number(fullReport.stats.net).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 mb-3">
              {(fullReport.days || []).map((r: any) => (
                <div key={r.work_date} className="flex gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: '#09090b' }}>
                  <span className="text-zinc-300 w-16">{fmtDate(r.work_date)}</span>
                  <span className="text-emerald-400" dir="ltr">{fmtTime(r.check_in_at)}</span>
                  <span className="text-red-400" dir="ltr">{fmtTime(r.check_out_at)}</span>
                  <span className="text-zinc-400 mr-auto" dir="ltr">{minsLabel(r.net_worked_minutes ?? r.worked_minutes)}</span>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-secondary w-full">إغلاق</button>
          </>
        )}
      </div>
    </div>
  )
}
