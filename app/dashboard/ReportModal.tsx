'use client'

import { useMemo, useState } from 'react'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

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
  if (c === 'SYP') return { label: 'سوري', color: '#f1ce83', symbol: 'ل.س' }
  if (c === 'TRY') return { label: 'تركي', color: '#f472b6', symbol: '₺' }
  return { label: 'دولار', color: '#34d399', symbol: '$' }
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return `${MONTHS_AR[m - 1]} ${y}`
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
  const [pickerOpen, setPickerOpen] = useState(false)

  const [year, month] = useMemo(() => {
    const [y, m] = (reportMonth || '').split('-').map(Number)
    const now = new Date()
    return [y || now.getFullYear(), m || now.getMonth() + 1]
  }, [reportMonth])

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear()
    return [cy - 1, cy, cy + 1]
  }, [])

  const withdrawals: any[] = fullReport?.withdrawals || []

  const byCurrency = withdrawals.reduce(
    (acc: Record<string, number>, w: any) => {
      const c = (w.currency || 'USD').toUpperCase()
      acc[c] = (acc[c] || 0) + (Number(w.amount) || 0)
      return acc
    },
    {} as Record<string, number>
  )

  const applyMonth = (y: number, m: number) => {
    const next = `${y}-${String(m).padStart(2, '0')}`
    setReportMonth(next)
    setPickerOpen(false)
    if (fullReport?.employee?.id) generateReport(fullReport.employee.id, next)
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 75 }} onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
        {reportLoading ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>جاري تحميل التقرير...</p>
        ) : fullReport && (
          <>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-right min-w-0">
                <h2 className="text-lg font-black m-0" style={{ color: 'var(--gold2)' }}>
                  {fullReport.employee.full_name}
                </h2>
                <p className="text-xs m-0 mt-1" style={{ color: 'var(--muted)' }}>
                  #{fullReport.employee.employee_number} · {fullReport.month || monthLabel(reportMonth)}
                </p>
              </div>
              <button type="button" className="btn-dark text-xs px-3 py-1.5" onClick={onClose}>إغلاق</button>
            </div>

            {/* منتقي الشهر المخصص */}
            <div className="relative mb-4">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: '#0c1218',
                  border: '1px solid rgba(214,163,75,.5)',
                  color: '#f3e5c7',
                  boxShadow: '0 0 18px rgba(214,163,75,.08)',
                }}
                onClick={() => setPickerOpen((v) => !v)}
              >
                <span style={{ color: 'var(--gold2)', fontSize: 12 }}>{pickerOpen ? '▴' : '▾'}</span>
                <span className="font-bold">{monthLabel(reportMonth)}</span>
              </button>

              {pickerOpen && (
                <div
                  className="absolute z-30 left-0 right-0 mt-2 rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg,#121a22,#0b1016)',
                    border: '1px solid rgba(214,163,75,.55)',
                    boxShadow: '0 16px 48px rgba(0,0,0,.65)',
                  }}
                >
                  <div className="px-3 pt-3 pb-2 text-center text-sm font-black" style={{ color: 'var(--gold2)' }}>
                    تعيين الشهر
                  </div>

                  <div className="flex gap-2 px-3 pb-2">
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className="flex-1 py-2 rounded-xl text-sm font-bold"
                        style={{
                          background: year === y ? 'rgba(214,163,75,.2)' : '#101820',
                          border: year === y ? '1px solid var(--gold)' : '1px solid rgba(214,163,75,.15)',
                          color: year === y ? 'var(--gold2)' : '#c8d0d6',
                        }}
                        onClick={() => applyMonth(y, month)}
                      >
                        {y}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                    {MONTHS_AR.map((name, idx) => {
                      const m = idx + 1
                      const active = month === m
                      return (
                        <button
                          key={name}
                          type="button"
                          className="py-2.5 rounded-xl text-xs font-bold"
                          style={{
                            background: active ? 'rgba(214,163,75,.22)' : '#0e151c',
                            border: active ? '1px solid var(--gold)' : '1px solid rgba(214,163,75,.12)',
                            color: active ? 'var(--gold2)' : '#dce1e4',
                          }}
                          onClick={() => applyMonth(year, m)}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex gap-2 px-3 pb-3">
                    <button type="button" className="btn-dark flex-1 text-sm" onClick={() => setPickerOpen(false)}>
                      إغلاق
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ملخص مالي */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl p-3" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.25)' }}>
                <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>الراتب الشهري</div>
                <div className="font-black" style={{ color: 'var(--gold2)' }} dir="ltr">
                  ${Number(fullReport.stats?.monthlySalary || 0).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.25)' }}>
                <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>الصافي المستحق</div>
                <div className="font-black" style={{ color: '#55d39d' }} dir="ltr">
                  ${Number(fullReport.stats?.netPay ?? fullReport.stats?.net ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.25)' }}>
                <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>أيام الدوام</div>
                <div className="font-black text-white">{fullReport.stats?.daysWorked ?? fullReport.stats?.presentDays ?? 0}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.25)' }}>
                <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>ساعات العمل</div>
                <div className="font-black text-white" dir="ltr">
                  {minsLabel(fullReport.stats?.totalMinutes ?? fullReport.stats?.workedMinutes)}
                </div>
              </div>
            </div>

            {/* السحوبات */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-extrabold m-0" style={{ color: 'var(--gold2)' }}>تفاصيل السحوبات</h3>
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{withdrawals.length} عملية</span>
              </div>

              {Object.keys(byCurrency).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(byCurrency).map(([code, total]) => {
                    const meta = currencyMeta(code)
                    return (
                      <span
                        key={code}
                        className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                        style={{
                          color: meta.color,
                          background: `${meta.color}18`,
                          border: `1px solid ${meta.color}55`,
                        }}
                      >
                        {meta.label}: {Number(total).toLocaleString('en-US')} {meta.symbol}
                      </span>
                    )
                  })}
                </div>
              )}

              {withdrawals.length === 0 ? (
                <div className="text-center text-xs py-3" style={{ color: 'var(--muted)' }}>لا توجد سحوبات</div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {withdrawals.map((w: any) => {
                    const meta = currencyMeta(w.currency)
                    const dt = fmtDateTime(w.withdrawn_at)
                    return (
                      <div
                        key={w.id}
                        className="rounded-xl px-3 py-2"
                        style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.15)' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{
                              color: meta.color,
                              background: `${meta.color}18`,
                              border: `1px solid ${meta.color}55`,
                            }}
                          >
                            {meta.label}
                          </span>
                          <span className="font-bold text-sm" style={{ color: meta.color }} dir="ltr">
                            {Number(w.amount).toLocaleString('en-US')} {meta.symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]" style={{ color: '#aeb8c0' }}>
                          <span>{dt.date}</span>
                          <span dir="ltr">{dt.time}</span>
                        </div>
                        {w.note && <p className="text-[11px] mt-1 m-0" style={{ color: 'var(--muted)' }}>{w.note}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* أيام الدوام */}
            <div className="mb-3">
              <h3 className="text-sm font-extrabold mb-2 m-0" style={{ color: 'var(--gold2)' }}>سجل الحضور</h3>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {(fullReport.days || []).length === 0 ? (
                  <div className="text-center text-xs py-3" style={{ color: 'var(--muted)' }}>لا يوجد دوام مسجل</div>
                ) : (
                  (fullReport.days || []).map((r: any) => (
                    <div
                      key={r.work_date}
                      className="flex gap-2 text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: '#0c1218', border: '1px solid rgba(214,163,75,.12)' }}
                    >
                      <span className="text-[#e2e8f0] w-16">{fmtDate(r.work_date)}</span>
                      <span style={{ color: '#55d39d' }} dir="ltr">{fmtTime(r.check_in_at)}</span>
                      <span style={{ color: '#ff7782' }} dir="ltr">{fmtTime(r.check_out_at)}</span>
                      <span className="mr-auto" style={{ color: 'var(--muted)' }} dir="ltr">
                        {minsLabel(r.net_worked_minutes ?? r.worked_minutes)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={onClose} className="btn-dark w-full">إغلاق</button>
          </>
        )}
      </div>
    </div>
  )
}
