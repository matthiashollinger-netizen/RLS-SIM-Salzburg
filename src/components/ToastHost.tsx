import { useNotificationStore, type ToastKind } from '../state/notificationStore.ts'
import './toast-host.css'

/**
 * Notification toast stack, top-right. Importing the store here activates
 * its module-level feeders (event log, Hilfsfrist watcher).
 *
 * The whole layer is purely informational and never intercepts pointer
 * events (toasts auto-dismiss): at small viewports the stack overlaps the
 * Einsatzliste, and clickable toasts would steal dispatch clicks. The
 * container stays mounted so the aria-live region announces reliably.
 */

const ICONS: Record<ToastKind, string> = {
  info: 'ℹ',
  ok: '✓',
  warn: '⚠',
  danger: '⛔',
}

export function ToastHost() {
  const toasts = useNotificationStore((s) => s.toasts)

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}${t.leaving ? ' toast-leaving' : ''}`}
          role="status"
        >
          <span className="toast-icon" aria-hidden="true">
            {ICONS[t.kind]}
          </span>
          <div className="toast-body">
            <strong className="toast-title">{t.title}</strong>
            <p className="toast-text">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
