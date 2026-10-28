'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [cafeName, setCafeName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeName, ownerName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل التسجيل')
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 1800)
    } catch {
      setError('خطأ في الاتصال')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1510 50%, #0a0a0a 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
          >
            <span style={{ fontSize: 28 }}>☕</span>
          </div>
          <h1 className="text-2xl font-bold text-white">إنشاء حساب مقهى</h1>
          <p className="text-zinc-400 text-sm mt-1">نسختك الخاصة — بيانات معزولة بالكامل</p>
        </div>

        {done ? (
          <div className="card text-center space-y-3">
            <p className="text-emerald-400 font-medium">تم إنشاء الحساب بنجاح</p>
            <p className="text-zinc-400 text-sm">جاري التحويل لتسجيل الدخول...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label">اسم المقهى / المطعم *</label>
              <input
                className="input-field"
                required
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                placeholder=""
                style={{ textAlign: 'right' }}
              />
            </div>
            <div>
              <label className="label">اسم المالك *</label>
              <input
                className="input-field"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder=""
                style={{ textAlign: 'right' }}
              />
            </div>
            <div>
              <label className="label">البريد الإلكتروني *</label>
              <input
                type="email"
                className="input-field"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
            </div>
            <div>
              <label className="label">كلمة المرور *</label>
              <input
                type="password"
                className="input-field"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
            </button>

            <p className="text-center text-sm text-zinc-500">
              عندك حساب؟{' '}
              <Link href="/login" className="text-amber-400 hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
