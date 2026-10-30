'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export function employeeQrValue(employeeId: string) {
  return `CSP1:${employeeId}`
}

export function parseEmployeeQr(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (s.startsWith('CSP1:')) return s.slice(5).trim() || null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s
  return null
}

export function EmployeeQrCard({
  employeeId,
  name,
  size = 180,
}: {
  employeeId: string
  name: string
  size?: number
}) {
  const value = employeeQrValue(employeeId)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl p-3" style={{ background: '#fff', border: '1px solid var(--line)' }}>
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      </div>
      <p className="text-xs m-0 text-center" style={{ color: 'var(--muted)' }}>
        QR ثابت لـ {name}
      </p>
      <p className="text-[10px] m-0 text-center break-all" dir="ltr" style={{ color: '#7a858e' }}>
        {value}
      </p>
    </div>
  )
}

export default function QrScanner({
  onScan,
  onClose,
  busy,
}: {
  onScan: (employeeId: string) => void | Promise<void>
  onClose: () => void
  busy?: boolean
}) {
  const regionId = 'csp-qr-reader'
  const scannerRef = useRef<any>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(regionId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            const id = parseEmployeeQr(decoded)
            if (!id) return
            const now = Date.now()
            if (lastRef.current.code === id && now - lastRef.current.at < 3500) return
            lastRef.current = { code: id, at: now }
            onScanRef.current(id)
          },
          () => {}
        )
        if (!cancelled) setReady(true)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'تعذر فتح الكاميرا. اسمح بالوصول للكاميرا.')
      }
    })()
    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {})
      }
    }
  }, [])

  return (
    <div className="modal-backdrop" style={{ zIndex: 85 }} onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="m-0 mb-2 font-black text-center" style={{ color: 'var(--gold2)' }}>
          مسح QR للحضور / الانصراف
        </h3>
        <p className="text-xs text-center m-0 mb-3" style={{ color: 'var(--muted)' }}>
          وجّه الكاميرا نحو QR الموظف — يُسجَّل حضور أو انصراف تلقائياً
        </p>
        <div
          id={regionId}
          className="overflow-hidden rounded-xl"
          style={{ minHeight: 260, background: '#0a0f14', border: '1px solid var(--line)' }}
        />
        {!ready && !error && (
          <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>
            جاري تشغيل الكاميرا...
          </p>
        )}
        {error && (
          <p className="text-xs text-center mt-2" style={{ color: '#ff7782' }}>
            {error}
          </p>
        )}
        {busy && (
          <p className="text-xs text-center mt-2 font-bold" style={{ color: 'var(--gold2)' }}>
            جاري التسجيل...
          </p>
        )}
        <button type="button" className="btn-dark w-full mt-3" onClick={onClose}>
          إغلاق الماسح
        </button>
      </div>
    </div>
  )
}
