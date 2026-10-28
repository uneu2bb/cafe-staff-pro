export default function DashboardPage() {
  return (
    <div style={{ padding: 32 }}>
      <h1>لوحة التحكم</h1>
      <p style={{ color: '#a1a1aa' }}>مرحباً بك في Cafe Staff Pro</p>
      <div className="card" style={{ marginTop: 24 }}>
        <p>النظام متصل بقاعدة البيانات.</p>
        <p style={{ color: '#a1a1aa', fontSize: 14 }}>استخدم شاشة الحضور من /kiosk</p>
      </div>
    </div>
  )
}
