export default function DashboardLoading() {
  return (
    <div
      className="min-h-screen grid place-items-center"
      style={{
        background: 'linear-gradient(160deg,#0c0c0e,#08080a)',
        color: '#f0d78c',
      }}
    >
      <div className="text-center">
        <div
          className="mx-auto mb-4"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: '2px solid rgba(212,175,55,0.35)',
            borderTopColor: '#d4af37',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <p className="m-0 text-sm font-bold" style={{ color: '#c4b89a' }}>
          جاري التحميل...
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
