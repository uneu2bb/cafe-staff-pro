'use client'

import { useState, useEffect, useCallback } from 'react'
import { Coffee, Calendar, Wifi, WifiOff, LogIn, LogOut, KeyRound, CheckCircle2, XCircle, Loader2, User } from 'lucide-react'

export default function KioskPage() {
  const [now, setNow] = useState(new Date())
  const [online, setOnline] = useState(true)
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; employeeName?: string } | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const u = () => setOnline(navigator.onLine)
    window.addEventListener('online', u)
    window.addEventListener('offline', u)
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u) }
  }, [])

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => { setResult(null); setEmployeeNumber(''); setPin('') }, 4000)
    return () => clearTimeout(t)
  }, [result])

  const punch = useCallback(async (type: 'check_in' | 'check_out') => {
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
        body: JSON.stringify({ employee_number: employeeNumber.trim(), pin, type, verification_method: 'pin' }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: data.message, employeeName: data.employee_name })
      } else {
        setResult({ success: false, message: data.error || 'فشلت العملية' })
      }
    } catch {
      setResult({ success: false, message: 'خطأ في الاتصال' })
    }
    setLoading(false)
  }, [employeeNumber, pin])

  const timeStr = now.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-700 to-amber-500 flex items-center justify-center">
            <Coffee className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Cafe Staff Pro</h1>
            <p className="text-xs text-zinc-500">شاشة الحضور والانصراف</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-sm ${online ? 'text-emerald-400' : 'text-red-400'}`}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online ? 'متصل' : 'غير متصل'}
        </div>
      </header>

      <div className="text-center py-8">
        <div className="text-6xl font-bold text-white font-mono tabular-nums">{timeStr}</div>
        <div className="flex items-center justify-center gap-2 mt-3 text-zinc-400">
          <Calendar size={16} />
          <span className="text-lg">{dateStr}</span>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4 pb-8">
        <div className="w-full max-w-lg space-y-6">
          {result && (
            <div className={`rounded-2xl p-5 border flex items-start gap-4 ${result.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              {result.success ? <CheckCircle2 className="text-emerald-400 shrink-0" size={28} /> : <XCircle className="text-red-400 shrink-0" size={28} />}
              <div>
                <p className={`font-bold text-lg ${result.success ? 'text-emerald-300' : 'text-red-300'}`}>{result.message}</p>
                {result.employeeName && <p className="text-zinc-400 mt-1 flex items-center gap-1.5"><User size={14} />{result.employeeName}</p>}
              </div>
            </div>
          )}

          <div className="card space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm"><KeyRound size={16} /> التحقق بالرقم السري</div>
            <div>
              <label className="label">الرقم الوظيفي</label>
              <input type="text" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} className="input-field text-center text-2xl tracking-widest font-mono" placeholder="0000" dir="ltr" autoFocus />
            </div>
            <div>
              <label className="label">الرمز السري</label>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="input-field text-center text-2xl tracking-widest font-mono" placeholder="••••" dir="ltr" maxLength={6} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => punch('check_in')} disabled={loading} className="btn-success flex items-center justify-center gap-3 py-5 text-lg rounded-2xl">
              {loading ? <Loader2 className="animate-spin" size={24} /> : <><LogIn size={24} /> حضور</>}
            </button>
            <button onClick={() => punch('check_out')} disabled={loading} className="btn-danger flex items-center justify-center gap-3 py-5 text-lg rounded-2xl">
              {loading ? <Loader2 className="animate-spin" size={24} /> : <><LogOut size={24} /> انصراف</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
