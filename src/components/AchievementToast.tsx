import { useEffect } from 'react'
import { useAchievementStore } from '../state/achievementStore.ts'
import './achievement-toast.css'

export function AchievementToast() {
  const toast = useAchievementStore((s) => s.toast)
  const clear = useAchievementStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clear, 6000)
    return () => clearTimeout(t)
  }, [toast, clear])

  if (!toast) return null
  return (
    <div className="achievement-toast" role="status" data-testid="achievement-toast">
      <span className="achievement-icon" aria-hidden="true">
        ★
      </span>
      <div>
        <strong>Erfolg freigeschaltet: {toast.title}</strong>
        <p>{toast.description}</p>
      </div>
    </div>
  )
}
