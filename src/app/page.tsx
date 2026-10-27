import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0 }}>Cafe Staff Pro</h1>
        <p style={{ color: '#a1a1aa' }}>نظام إدارة الموظفين والحضور والانصراف</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          <Link href="/login" className="btn-primary" style={{ display: 'block', textDecoration: 'none' }}>
            تسجيل الدخول
          </Link>
          <Link href="/kiosk" className="btn-success" style={{ display: 'block', textDecoration: 'none' }}>
            شاشة الحضور
          </Link>
        </div>
      </div>
    </div>
  )
}
