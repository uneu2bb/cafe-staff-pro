'use client'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-SY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function fmtDateTime(iso: string | null) {
  if (!iso) return { date: '—', time: '—' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('ar-SY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('ar-SY', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
  }
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
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

function currencyMeta(code: string) {
  const c = (code || 'USD').toUpperCase()
  if (c === 'SYP') return { label: 'سوري', color: '#fbbf24', symbol: 'ل.س' }
  if (c === 'TRY') return { label: 'تركي', color: '#f472b6', symbol: '₺' }
  return { label: 'دولار', color: '#34d399', symbol: '$' }
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
  const withdrawals: any[] = fullReport?.withdrawals || []

  const byCurrency = withdrawals.reduce(
    (acc: Record<string, number>, w: any) => {
      const c = (w.currency || 'USD').toUpperCase()
      acc[c] = (acc[c] || 0) + (Number(w.amount) || 0)
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
        {reportLoading ? (
          <p className="text-center text-[#5a7a9a] py-10">جاري تحميل التقرير...</p>
        ) : fullReport && (
          <>
            <h2 className="text-lg font-bold text-white">{fullReport.employee.full_name}</h2>
            <p className="text-xs text-[#5a7a9a] mb-3">
              #{fullReport.employee.employee_number} · {fullReport.month}
            </p>

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
                <p className="text-xs text-[#5a7a9a]">أيام الدوام</p>
                <p className="text-xl font-bold" style={{ color: '#00ffcc' }}>{fullReport.stats.presentDays}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-[#5a7a9a]">ساعات العمل</p>
                <p className="text-xl font-bold text-amber-400">{Number(fullReport.stats.totalHours).toFixed(2)}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-[#5a7a9a]">يطلعله باليوم</p>
                <p className="text-xl font-bold text-sky-400">${Number(fullReport.stats.dayRate).toFixed(2)}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <p className="text-xs text-[#5a7a9a]">أجر الساعة</p>
                <p className="text-xl font-bold text-violet-400">${Number(fullReport.stats.hourlyRate).toFixed(2)}</p>
              </div>
            </div>

            <div className="card mb-3" style={{ padding: 14 }}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]">الراتب الشهري</span>
                  <span className="text-white">${Number(fullReport.stats.monthlySalary).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]">أجر الساعة ({fullReport.stats.hoursPerDay || 8}س/يوم)</span>
                  <span className="text-violet-400">${Number(fullReport.stats.hourlyRate).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]">ساعات × أجر الساعة</span>
                  <span className="text-amber-400">
                    {Number(fullReport.stats.totalHours).toFixed(2)} × ${Number(fullReport.stats.hourlyRate).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8ab4f8]">إجمالي أجر الساعات</span>
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
                  <span className="text-[#8ab4f8]">إجمالي السحوبات (بالدولار)</span>
                  <span className="text-red-400">− ${Number(fullReport.stats.withdrawnUsd).toFixed(2)}</span>
                </div>
                <div className="border-t my-2" style={{ borderColor: 'rgba(0,255,204,0.2)' }} />
                <div className="flex justify-between">
                  <span className="text-white font-bold">الصافي المستحق</span>
                  <span className="font-bold text-lg" style={{ color: '#00ffcc' }}>
                    ${Number(fullReport.stats.net).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* تفاصيل السحوبات */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold" style={{ color: '#00ffcc' }}>
                  تفاصيل السحوبات
                </h3>
                <span className="text-[11px] text-[#5a7a9a]">{withdrawals.length} عملية</span>
              </div>

              {Object.keys(byCurrency).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {Object.entries(byCurrency).map(([code, total]) => {
                    const meta = currencyMeta(code)
                    return (
                      <span
                        key={code}
                        className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: 'rgba(0,255,204,0.08)',
                          border: `1px solid ${meta.color}55`,
                          color: meta.color,
                        }}
                      >
                        {meta.label}: {Number(total).toLocaleString('en-US')} {meta.symbol}
                      </span>
                    )
                  })}
                </div>
              )}

              {withdrawals.length === 0 ? (
                <div
                  className="text-center text-xs py-4 rounded-xl"
                  style={{ background: 'rgba(10,20,35,0.7)', border: '1px solid rgba(0,255,204,0.15)', color: '#5a7a9a' }}
                >
                  لا توجد سحوبات في هذا الشهر
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {withdrawals.map((w: any, i: number) => {
                    const meta = currencyMeta(w.currency)
                    const dt = fmtDateTime(w.withdrawn_at)
                    return (
                      <div
                        key={w.id || i}
                        className="rounded-xl px-3 py-2.5"
                        style={{
                          background: 'rgba(10,20,35,0.75)',
                          border: '1px solid rgba(0,255,204,0.18)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                            style={{
                              background: `${meta.color}22`,
                              color: meta.color,
                              border: `1px solid ${meta.color}55`,
                            }}
                          >
                            {meta.label}
                          </span>
                          <span className="font-bold text-sm" style={{ color: meta.color }} dir="ltr">
                            {Number(w.amount).toLocaleString('en-US')} {meta.symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#8ab4f8]">
                          <span>{dt.date}</span>
                          <span dir="ltr">{dt.time}</span>
                        </div>
                        {w.note && (
                          <p className="text-[11px] text-[#5a7a9a] mt-1">{w.note}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* أيام الدوام */}
            <div className="mb-3">
              <h3 className="text-sm font-bold mb-2" style={{ color: '#00ffcc' }}>
                سجل الحضور
              </h3>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {(fullReport.days || []).length === 0 ? (
                  <div className="text-center text-xs py-3 text-[#5a7a9a]">لا يوجد دوام مسجل</div>
                ) : (
                  (fullReport.days || []).map((r: any) => (
                    <div
                      key={r.work_date}
                      className="flex gap-2 text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: 'rgba(10,20,35,0.75)', border: '1px solid rgba(0,255,204,0.12)' }}
                    >
                      <span className="text-[#e2e8f0] w-16">{fmtDate(r.work_date)}</span>
                      <span style={{ color: '#00ffcc' }} dir="ltr">{fmtTime(r.check_in_at)}</span>
                      <span className="text-red-400" dir="ltr">{fmtTime(r.check_out_at)}</span>
                      <span className="text-[#5a7a9a] mr-auto" dir="ltr">
                        {minsLabel(r.net_worked_minutes ?? r.worked_minutes)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={onClose} className="btn-secondary w-full">
              إغلاق
            </button>
          </>
        )}
      </div>
    </div>
  )
}
