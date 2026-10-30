'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('البريد أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }
      router.replace('/dashboard')
    } catch {
      setError('خطأ في الاتصال')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at top, rgba(214,163,75,0.08), transparent 50%), #070a0d',
      }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
          style={{
            background: 'rgba(214,163,75,0.1)',
            border: '1px solid rgba(214,163,75,0.4)',
          }}
        >
          <span style={{ fontSize: 26 }}>☕</span>
        </div>

        <p className="text-sm mb-6" style={{ color: '#9ca7b0' }}>
          تسجيل الدخول إلى النظام
        </p>

        <form
          onSubmit={handleLogin}
          className="space-y-4 text-right"
          style={{
            background: '#101920',
            border: '1px solid rgba(214,163,75,0.3)',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              autoComplete="email"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoComplete="current-password"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-3 py-2.5 text-sm text-center"
              style={{
                background: 'rgba(216,62,77,0.12)',
                border: '1px solid rgba(216,62,77,0.4)',
                color: '#ff7782',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold w-full py-3 text-base">
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
