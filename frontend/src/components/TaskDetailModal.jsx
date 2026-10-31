import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { STATUSES, STATUS_LABELS, patchTask } from '../tasks.js'

// REC-27: editable task detail, shown as a big card centered over a blurred
// page. It grows out of the card that was clicked and shrinks back into it on
// close. Standalone on purpose — the Board opens it first, REC-11's chat cards
// will open the same component.
//
// Props:
//   task          — a task as returned by /api/board or PATCH /api/tasks/{id}
//   onClose       — called once the close animation has finished
//   onSaved       — called with the updated task after every successful save
//   getOriginRect — optional () => DOMRect of the element to grow from and
//                   shrink back into; without it the card just fades in/out
//
// Edits save directly: text fields on blur, status on click. Closing blurs the
// focused field first, so an edit in progress is saved, not dropped.
function draftFrom(task) {
  return {
    title: task.title ?? '',
    first_action: task.first_action ?? '',
    est_minutes: task.est_minutes ?? '',
    note: task.note ?? '',
  }
}

// Draft (string) -> API value. Empty optional fields clear to null.
function toApiValue(field, value) {
  if (field === 'est_minutes') {
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (field === 'title') return value.trim()
  return value.trim() === '' ? null : value
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Transform that makes `el` (at its natural position) sit exactly on `rect`.
// The card's transform-origin is top-left, so translate then scale lines up.
function transformTo(el, rect) {
  const own = el.getBoundingClientRect()
  const dx = rect.left - own.left
  const dy = rect.top - own.top
  return `translate(${dx}px, ${dy}px) scale(${rect.width / own.width}, ${rect.height / own.height})`
}

export default function TaskDetailModal({ task, onClose, onSaved, getOriginRect }) {
  const [draft, setDraft] = useState(() => draftFrom(task))
  const [saveState, setSaveState] = useState(null) // null | 'saving' | 'saved' | 'error'
  const cardRef = useRef(null)
  const contentRef = useRef(null)
  const scrimRef = useRef(null)
  const closing = useRef(false)

  // Switching to a different task resets the draft.
  useEffect(() => {
    setDraft(draftFrom(task))
    setSaveState(null)
  }, [task.id])

  // Open: grow from the clicked card.
  useLayoutEffect(() => {
    const card = cardRef.current
    const origin = getOriginRect?.()
    const opts = { duration: 280, easing: EASE }
    const anims = [scrimRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 })]
    if (origin && !reducedMotion()) {
      anims.push(
        card.animate([{ transform: transformTo(card, origin) }, { transform: 'none' }], opts),
        contentRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 160,
          delay: 130,
          fill: 'backwards',
        }),
      )
    } else {
      anims.push(
        card.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], opts),
      )
    }
    card.focus({ preventScroll: true })
    // StrictMode re-runs this effect in dev; cancel so the re-run measures the
    // card untransformed instead of mid-animation.
    return () => anims.forEach((a) => a.cancel())
  }, [])

  function requestClose() {
    if (closing.current) return
    closing.current = true
    document.activeElement?.blur() // flush save-on-blur for the field being edited

    const card = cardRef.current
    const origin = getOriginRect?.()
    const opts = { duration: 220, easing: EASE, fill: 'forwards' }
    scrimRef.current.animate([{ opacity: 1 }, { opacity: 0 }], opts)
    let anim
    if (origin && !reducedMotion()) {
      contentRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' })
      anim = card.animate([{ transform: 'none' }, { transform: transformTo(card, origin) }], opts)
    } else {
      anim = card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.97)' }], opts)
    }
    anim.finished.then(onClose, onClose)
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function save(changes) {
    setSaveState('saving')
    try {
      const updated = await patchTask(task.id, changes)
      setSaveState('saved')
      onSaved?.(updated)
    } catch {
      setSaveState('error')
    }
  }

  function saveField(field) {
    const value = toApiValue(field, String(draft[field]))
    if (field === 'title' && !value) {
      // Title is required — revert rather than save a blank.
      setDraft((d) => ({ ...d, title: task.title }))
      return
    }
    if (value === (task[field] ?? null)) return
    save({ [field]: value })
  }

  function bind(field) {
    return {
      value: draft[field],
      onChange: (e) => setDraft((d) => ({ ...d, [field]: e.target.value })),
      onBlur: () => saveField(field),
    }
  }

  return (
    <div className="modal-root">
      <div className="modal-scrim" ref={scrimRef} onMouseDown={requestClose} />
      <div
        className="task-modal"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        tabIndex={-1}
      >
        <div className="task-modal-content" ref={contentRef}>
          <header className="task-modal-header">
            <span className="task-modal-crumb">
              {task.story_title ? `${task.story_title} · ${task.epic_name}` : 'Not part of a story'}
            </span>
            <button className="task-modal-close" onClick={requestClose} aria-label="Close">
              ×
            </button>
          </header>

          <input className="task-modal-title" aria-label="Title" {...bind('title')} />

          <div className="status-pick" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`status-pick-item${task.status === s ? ' active' : ''}`}
                aria-pressed={task.status === s}
                onClick={() => task.status !== s && save({ status: s })}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="field-row">
            <label className="field field-grow">
              <span className="field-label">First action</span>
              <input
                className="field-input"
                placeholder="The smallest physical step"
                {...bind('first_action')}
              />
            </label>
            <label className="field field-narrow">
              <span className="field-label">Estimate (min)</span>
              <input className="field-input" type="number" min="1" {...bind('est_minutes')} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              className="field-input field-textarea"
              rows={6}
              placeholder="Anything worth remembering about this task"
              {...bind('note')}
            />
          </label>

          <p className="task-modal-footer">
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && (
              <span className="task-modal-error">Couldn't save — is the backend running?</span>
            )}
            {saveState === null && 'Edits save directly. Esc or click outside to close.'}
          </p>
        </div>
      </div>
    </div>
  )
}
