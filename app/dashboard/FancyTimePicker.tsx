'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/** value = "HH:mm" 24h or "" */
export default function FancyTimePicker({
  value,
  onChange,
  label = 'انصراف تلقائي',
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const [open, setOpen] = useState<'hour' | 'minute' | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo(() => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      return { hour12: 9, minute: 0, ampm: 'PM' as 'AM' | 'PM' }
    }
    const [h24, m] = value.split(':').map(Number)
    const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
    let hour12 = h24 % 12
    if (hour12 === 0) hour12 = 12
    return { hour12, minute: m - (m % 5), ampm }
  }, [value])

  const emit = (hour12: number, minute: number, ampm: 'AM' | 'PM') => {
    let h24 = hour12 % 12
    if (ampm === 'PM') h24 += 12
    if (ampm === 'AM' && hour12 === 12) h24 = 0
    if (ampm === 'PM' && hour12 === 12) h24 = 12
    onChange(String(h24).padStart(2, '0') + ':' + String(minute).padStart(2, '0'))
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [])

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const pill = (active: boolean): React.CSSProperties => ({
    background: active
      ? 'linear-gradient(135deg,#D6A84F,#F1CE83)'
      : '#141c24',
    color: active ? '#0a0e12' : '#F1CE83',
    border: active ? '1px solid transparent' : '1px solid rgba(214,168,79,0.4)',
    borderRadius: 14,
    padding: '12px 14px',
    minWidth: 72,
    fontWeight: 900,
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: active ? '0 4px 16px rgba(214,168,79,0.25)' : 'none',
  })

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    width: 120,
    maxHeight: 220,
    overflowY: 'auto',
    background: 'linear-gradient(180deg,#121a22 0%,#0c1218 100%)',
    border: '1px solid rgba(214,168,79,0.45)',
    borderRadius: 16,
    boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(214,168,79,0.08)',
    padding: 6,
  }

  const itemStyle = (selected: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '10px 8px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: selected ? 900 : 600,
    fontSize: 16,
    marginBottom: 2,
    background: selected
      ? 'linear-gradient(135deg,#D6A84F,#F1CE83)'
      : 'transparent',
    color: selected ? '#0a0e12' : '#e8eef3',
  })

  return (
    <div ref={rootRef}>
      <label className="label">{label}</label>
      <div
        style={{
          background: '#0c1218',
          border: '1px solid rgba(214,168,79,0.35)',
          borderRadius: 16,
          padding: '14px 14px 12px',
        }}
      >
        <div className="flex items-end justify-center gap-2" dir="ltr">
          {/* ساعة */}
          <div className="relative flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: '#8a969f' }}>ساعة</span>
            <button
              type="button"
              onClick={() => setOpen(open === 'hour' ? null : 'hour')}
              style={pill(open === 'hour')}
            >
              {parsed.hour12}
            </button>
            {open === 'hour' && (
              <div style={menuStyle}>
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    style={itemStyle(h === parsed.hour12)}
                    onClick={() => {
                      emit(h, parsed.minute, parsed.ampm)
                      setOpen(null)
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="font-black text-2xl mb-2" style={{ color: 'var(--gold2)' }}>:</span>

          {/* دقيقة */}
          <div className="relative flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: '#8a969f' }}>دقيقة</span>
            <button
              type="button"
              onClick={() => setOpen(open === 'minute' ? null : 'minute')}
              style={pill(open === 'minute')}
            >
              {String(parsed.minute).padStart(2, '0')}
            </button>
            {open === 'minute' && (
              <div style={menuStyle}>
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    style={itemStyle(m === parsed.minute)}
                    onClick={() => {
                      emit(parsed.hour12, m, parsed.ampm)
                      setOpen(null)
                    }}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ص / م */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: '#8a969f' }}>الفترة</span>
            <div
              className="flex overflow-hidden"
              style={{
                borderRadius: 14,
                border: '1px solid rgba(214,168,79,0.45)',
              }}
            >
              {(['AM', 'PM'] as const).map((p) => {
                const on = parsed.ampm === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => emit(parsed.hour12, parsed.minute, p)}
                    className="px-3.5 py-3 text-sm font-black"
                    style={{
                      background: on
                        ? 'linear-gradient(135deg,#D6A84F,#F1CE83)'
                        : '#141c24',
                      color: on ? '#0a0e12' : '#c8d0d6',
                      minWidth: 44,
                    }}
                  >
                    {p === 'AM' ? 'ص' : 'م'}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between mt-3 pt-2"
          style={{ borderTop: '1px solid rgba(214,168,79,0.15)' }}
        >
          <p className="m-0 text-[11px] font-bold" style={{ color: '#c8d0d6' }}>
            {value
              ? 'وقت الإيقاف: ' +
                parsed.hour12 +
                ':' +
                String(parsed.minute).padStart(2, '0') +
                ' ' +
                (parsed.ampm === 'AM' ? 'صباحاً' : 'مساءً')
              : 'لم يُحدَّد وقت بعد — اضغط الساعة أو الدقيقة'}
          </p>
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[11px] px-2.5 py-1 rounded-lg font-bold"
              style={{
                border: '1px solid #d83e4d55',
                color: '#ff7782',
                background: '#1a1012',
              }}
            >
              مسح
            </button>
          ) : null}
        </div>
      </div>
      <p className="m-0 mt-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
        عند حلول هذا الوقت يُوقف التايمر ويُحفظ الدوام تلقائياً (والشاشة مفتوحة).
      </p>
    </div>
  )
}
