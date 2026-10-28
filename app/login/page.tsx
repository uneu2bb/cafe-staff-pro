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
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('خطأ في الاتصال')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={handleLogin} className="card" style={{ maxWidth: 400, width: '100%' }}>
        <h1 style={{ textAlign: 'center', marginTop: 0 }}>تسجيل الدخول</h1>
        <div style={{ marginBottom: 16 }}>
          <label className="label">البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" required dir="ltr" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="label">كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required dir="ltr" />
        </div>
        {error && <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  )
}
