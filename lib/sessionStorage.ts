/** جلسات الحضور المحلية — تبقى بعد إغلاق المتصفح */
export type Session = {
  startMs: number
  endMs: number | null
  running: boolean
}

const SESS_KEY = 'cafe_staff_sessions'

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function loadStoredSessions(): Record<string, Session> {
  try {
    const raw = localStorage.getItem(SESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { date: string; sessions: Record<string, Session> }
    if (parsed.date !== todayKey()) {
      localStorage.removeItem(SESS_KEY)
      return {}
    }
    return parsed.sessions || {}
  } catch {
    return {}
  }
}

export function persistSessions(sessions: Record<string, Session>) {
  try {
    if (Object.keys(sessions).length === 0) {
      localStorage.removeItem(SESS_KEY)
      return
    }
    localStorage.setItem(SESS_KEY, JSON.stringify({ date: todayKey(), sessions }))
  } catch {
    /* private mode */
  }
}

export function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
