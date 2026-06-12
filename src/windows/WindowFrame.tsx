import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useWindowStore, type WindowId } from './windowStore.ts'
import { ErrorBoundary } from '../components/ErrorBoundary.tsx'
import './windows.css'

interface WindowFrameProps {
  id: WindowId
  title: string
  children: ReactNode
}

/**
 * Minimal window chrome per design/DESIGN_SYSTEM.md: titlebar with title,
 * minimize + close; drag via titlebar, resize via bottom-right handle.
 */
export function WindowFrame({ id, title, children }: WindowFrameProps) {
  const win = useWindowStore((s) => s.windows[id])
  const isTop = useWindowStore((s) => s.windows[id]?.z === s.maxZ)
  const frameRef = useRef<HTMLDivElement>(null)
  // drag-lift: bigger shadow + grabbing cursor while the titlebar is dragged
  const [dragging, setDragging] = useState(false)

  const onTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      const { focus, move } = useWindowStore.getState()
      focus(id)
      const start = useWindowStore.getState().windows[id]
      if (!start) return
      const offX = e.clientX - start.x
      const offY = e.clientY - start.y
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      setDragging(true)
      const onMove = (ev: PointerEvent) => move(id, ev.clientX - offX, ev.clientY - offY)
      const onUp = () => {
        setDragging(false)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [id],
  )

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      const { focus, resize } = useWindowStore.getState()
      focus(id)
      const start = useWindowStore.getState().windows[id]
      if (!start) return
      const baseX = e.clientX
      const baseY = e.clientY
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      const onMove = (ev: PointerEvent) =>
        resize(id, {
          x: start.x,
          y: start.y,
          w: start.w + (ev.clientX - baseX),
          h: start.h + (ev.clientY - baseY),
        })
      const onUp = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [id],
  )

  if (!win || !win.open) return null

  return (
    <section
      ref={frameRef}
      className={`window-frame${isTop ? ' window-frame-active' : ''}${win.minimized ? ' window-frame-minimized' : ''}${dragging ? ' window-dragging' : ''}`}
      style={{
        transform: `translate(${win.x}px, ${win.y}px)`,
        width: win.w,
        height: win.minimized ? undefined : win.h,
        zIndex: win.z,
      }}
      data-window-id={id}
      aria-label={title}
      onPointerDown={() => useWindowStore.getState().focus(id)}
    >
      <header className="window-titlebar" onPointerDown={onTitlePointerDown}>
        <span className="window-title">{title}</span>
        <div className="window-controls">
          <button
            aria-label={win.minimized ? `${title} wiederherstellen` : `${title} minimieren`}
            title={win.minimized ? 'Wiederherstellen' : 'Minimieren'}
            onClick={() => useWindowStore.getState().toggleMinimized(id)}
          >
            {win.minimized ? '▢' : '–'}
          </button>
          <button
            aria-label={`${title} schließen`}
            title="Schließen"
            onClick={() => useWindowStore.getState().setOpen(id, false)}
          >
            ×
          </button>
        </div>
      </header>
      {!win.minimized && (
        <>
          <div className="window-content">
            <ErrorBoundary label={title}>{children}</ErrorBoundary>
          </div>
          <div
            className="window-resize-handle"
            onPointerDown={onResizePointerDown}
            aria-hidden="true"
          />
        </>
      )}
    </section>
  )
}
