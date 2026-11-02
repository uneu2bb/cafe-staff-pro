'use client'

import { useMemo } from 'react'

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
  const parsed = useMemo(() => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      return { hour12: 9, minute: 0, ampm: 'PM' as 'AM' | 'PM' }
    }
    const [h24, m] = value.split(':').map(Number)
    const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
    let hour12 = h24 % 12
    if (hour12 === 0) hour12 = 12
    return { hour12, minute: m, ampm }
  }, [value])

  const emit = (hour12: number, minute: number, ampm: 'AM' | 'PM') => {
    let h24 = hour12 % 12
    if (ampm === 'PM') h24 += 12
    if (ampm === 'AM' && hour12 === 12) h24 = 0
    if (ampm === 'PM' && hour12 === 12) h24 = 12
    const v =
      String(h24).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
    onChange(v)
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const box: React.CSSProperties = {
    background: '#0c1218',
    border: '1px solid rgba(214,168,79,0.35)',
    borderRadius: 14,
    padding: '12px 14px',
  }
  const selectStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: '#141c24',
    color: '#F1CE83',
    border: '1px solid rgba(214,168,79,0.45)',
    borderRadius: 12,
    padding: '10px 8px',
    fontSize: 16,
    fontWeight: 800,
    textAlign: 'center',
    minWidth: 64,
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div style={box}>
        <div className="flex items-center justify-center gap-2" dir="ltr">
          {/* ساعة */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px]" style={{ color: '#8a969f' }}>ساعة</span>
            <select
              value={parsed.hour12}
              onChange={(e) => emit(Number(e.target.value), parsed.minute, parsed.ampm)}
              style={selectStyle}
            >
              {hours.map((h) => (
                <option key={h} value={h} style={{ background: '#141c24', color: '#F1CE83' }}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <span className="font-black text-xl mt-4" style={{ color: 'var(--gold2)' }}>:</span>

          {/* دقيقة */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px]" style={{ color: '#8a969f' }}>دقيقة</span>
            <select
              value={parsed.minute - (parsed.minute % 5)}
              onChange={(e) => emit(parsed.hour12, Number(e.target.value), parsed.ampm)}
              style={selectStyle}
            >
              {minutes.map((m) => (
                <option key={m} value={m} style={{ background: '#141c24', color: '#F1CE83' }}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* ص / م */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px]" style={{ color: '#8a969f' }}>الفترة</span>
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(214,168,79,0.45)' }}>
              {(['AM', 'PM'] as const).map((p) => {
                const on = parsed.ampm === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => emit(parsed.hour12, parsed.minute, p)}
                    className="px-3 py-2 text-xs font-black"
                    style={{
                      background: on ? 'linear-gradient(135deg,#D6A84F,#F1CE83)' : '#141c24',
                      color: on ? '#0a0e12' : '#c8d0d6',
                      minWidth: 42,
                    }}
                  >
                    {p === 'AM' ? 'ص' : 'م'}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid rgba(214,168,79,0.15)' }}>
          <p className="m-0 text-[11px]" style={{ color: '#8a969f' }}>
            {value
              ? 'وقت الإيقاف: ' +
                parsed.hour12 +
                ':' +
                String(parsed.minute).padStart(2, '0') +
                ' ' +
                (parsed.ampm === 'AM' ? 'صباحاً' : 'مساءً')
              : 'لم يُحدَّد وقت بعد'}
          </p>
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[11px] px-2 py-1 rounded-lg"
              style={{ border: '1px solid #d83e4d55', color: '#ff7782', background: '#1a1012' }}
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
