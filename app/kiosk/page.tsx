'use client'

import { useState, useEffect } from 'react'

export default function KioskPage() {
  const [now, setNow] = useState<Date | null>(null)
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; name?: string } | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => {
      setResult(null)
      setEmployeeNumber('')
      setPin('')
    }, 4000)
    return () => clearTimeout(t)
  }, [result])

  const punch = async (type: 'check_in' | 'check_out') => {
    if (!employeeNumber.trim()) {
      setResult({ success: false, message: 'أدخل الرقم الوظيفي' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_number: employeeNumber.trim(),
          pin,
          type,
          verification_method: 'pin',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: data.message, name: data.employee_name })
      } else {
        setResult({ success: false, message: data.error || 'فشلت العملية' })
      }
    } catch {
      setResult({ success: false, message: 'خطأ في الاتصال' })
    }
    setLoading(false)
  }

  const timeStr = now
    ? now.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--'

  return (
    <div style={{ minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ margin: 0 }}>Cafe Staff Pro</h1>
        <div style={{ fontSize: 48, fontWeight: 'bold', marginTop: 16, fontFamily: 'monospace' }}>{timeStr}</div>
      </div>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        {result && (
          <div className="card" style={{ marginBottom: 16, borderColor: result.success ? '#059669' : '#dc2626', color: result.success ? '#6ee7b7' : '#fca5a5' }}>
            <strong>{result.message}</strong>
            {result.name && <div style={{ marginTop: 8, color: '#a1a1aa' }}>{result.name}</div>}
          </div>
        )}
        <div className="card" style={{ marginBottom: 16 }}>
          <label className="label">الرقم الوظيفي</label>
          <input className="input-field" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="001" dir="ltr" />
          <div style={{ height: 12 }} />
          <label className="label">الرمز السري</label>
          <input className="input-field" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" dir="ltr" maxLength={6} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="btn-success" disabled={loading} onClick={() => punch('check_in')}>{loading ? '...' : 'حضور'}</button>
          <button className="btn-danger" disabled={loading} onClick={() => punch('check_out')}>{loading ? '...' : 'انصراف'}</button>
        </div>
      </div>
    </div>
  )
}
