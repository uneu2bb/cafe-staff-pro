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
  const [showPass, setShowPass] = useState(false)

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
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(214,168,79,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(90,163,224,0.06), transparent 45%), #05080c',
      }}
    >
      {/* ambient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(214,168,79,0.1), transparent 70%)',
          top: '12%',
          right: '-5%',
          filter: 'blur(2px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,163,224,0.07), transparent 70%)',
          bottom: '8%',
          left: '-4%',
        }}
      />

      <div className="w-full max-w-md relative z-10 fade-up">
        {/* brand mark */}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 grid place-items-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(145deg, rgba(214,168,79,0.2), rgba(20,28,36,0.9))',
              border: '1px solid rgba(214,168,79,0.4)',
              boxShadow: '0 12px 40px rgba(214,168,79,0.15)',
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 900, color: '#f1ce83' }}>L</span>
          </div>
          <h1
            className="m-0 text-2xl font-black tracking-wide"
            style={{ color: '#f1ce83' }}
          >
            LMR
          </h1>
          <p className="m-0 mt-2 text-sm" style={{ color: '#8b96a0' }}>
            نظام إدارة الموظفين والحضور
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5 text-right"
          style={{
            background:
              'linear-gradient(165deg, rgba(20,30,40,0.95) 0%, rgba(10,16,22,0.98) 100%)',
            border: '1px solid rgba(214,168,79,0.28)',
            borderRadius: 22,
            padding: '28px 26px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(214,168,79,0.06)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="text-center mb-1">
            <p className="m-0 text-base font-bold" style={{ color: '#f4f1ea' }}>
              تسجيل الدخول
            </p>
            <p className="m-0 mt-1 text-xs" style={{ color: '#8b96a0' }}>
              أدخل بيانات حسابك للمتابعة
            </p>
          </div>

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
              placeholder="name@example.com"
              style={{ textAlign: 'left' }}
            />
          </div>

          <div>
            <label className="label">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                style={{ textAlign: 'left', paddingLeft: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-lg"
                style={{
                  border: '1px solid rgba(214,168,79,0.25)',
                  background: 'rgba(20,28,36,0.9)',
                  color: '#f1ce83',
                  fontWeight: 700,
                }}
              >
                {showPass ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
          </div>

          {error ? (
            <div
              className="text-sm text-center py-2.5 px-3 rounded-xl"
              style={{
                background: 'rgba(224,72,86,0.12)',
                border: '1px solid rgba(224,72,86,0.35)',
                color: '#ff8a93',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full"
            style={{ padding: '13px 18px', fontSize: 15, borderRadius: 14 }}
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>

        <p className="text-center mt-6 text-[11px]" style={{ color: '#5c6770' }}>
          محمي وآمن · LMR Staff System
        </p>
      </div>
    </div>
  )
}
