import { useEffect, useRef } from 'react'

// REC-30: "Done: … · Undo" toast. Disappears after `ms`; a new toast
// (different `id`) restarts the timer.
export default function UndoToast({ id, message, onUndo, onDismiss, ms = 5000 }) {
  const ref = useRef(null)

  useEffect(() => {
    const timer = setTimeout(onDismiss, ms)
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current?.animate(
        [
          { opacity: 0, transform: 'translate(-50%, 8px)' },
          { opacity: 1, transform: 'translate(-50%, 0)' },
        ],
        { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
    }
    return () => clearTimeout(timer)
  }, [id])

  return (
    <div className="undo-toast" ref={ref} role="status">
      <span>{message}</span>
      <button
        onClick={() => {
          onDismiss()
          onUndo()
        }}
      >
        Undo
      </button>
    </div>
  )
}
