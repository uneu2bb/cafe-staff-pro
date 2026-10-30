'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brandName, setBrandName] = useState('LMR')

  useEffect(() => {
    fetch('/api/public/brand')
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setBrandName(d.name)
      })
      .catch(() => {})
  }, [])

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
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('خطأ في الاتصال')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(214,168,79,0.12), transparent 50%), radial-gradient(ellipse at bottom, rgba(214,168,79,0.06), transparent 45%), #080D12',
      }}
    >
      <div className="w-full max-w-md fade-up text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 glow-pulse"
          style={{
            background: 'rgba(214,168,79,0.12)',
            border: '1.5px solid #D6A84F',
          }}
        >
          <span style={{ fontSize: 28 }}>☕</span>
        </div>

        <h1 className="gold-title text-3xl md:text-4xl mb-2">{brandName}</h1>
        <p className="gold-subtitle mb-8">نظام إدارة الحضور والانصراف</p>

        <form
          onSubmit={handleLogin}
          className="space-y-5 text-right"
          style={{
            background: '#101820',
            border: '1px solid rgba(214,168,79,0.35)',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
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
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm text-center"
              style={{
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(220,38,38,0.4)',
                color: '#F87171',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
