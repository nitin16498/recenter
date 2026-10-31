import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { celebrate } from '../fx.js'
import { useSettings } from '../settings.js'
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_ORDER,
  completeStep,
  currentStepIndex,
  doneStepCount,
  patchTask,
  replaceSteps,
  undoStep,
} from '../tasks.js'
import StepEditor from './StepEditor.jsx'
import StepStepper from './StepStepper.jsx'
import StepTimeline from './StepTimeline.jsx'

// REC-27: editable task detail, shown as a big card centered over a blurred
// page. It grows out of the card that was clicked and shrinks back into it on
// close. Standalone on purpose — the Board opens it first, REC-11's chat cards
// will open the same component.
// REC-30: the task's steps, as a Stepper or Timeline (Settings), with Mark
// done, Undo, an Edit steps editor, and celebrations on forward moves.
//
// Props:
//   task          — a task as returned by /api/board or the task endpoints
//   onClose       — called once the close animation has finished
//   onSaved       — called with the updated task after every successful save
//   onNotify      — optional (message, undo) => void for an Undo toast
//   getOriginRect — optional () => DOMRect of the element to grow from and
//                   shrink back into; without it the card just fades in/out
//
// Edits save directly: text fields on blur, status and steps on click.
// Closing blurs the focused field first, so an edit in progress is saved.
function draftFrom(task) {
  return {
    title: task.title ?? '',
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

export default function TaskDetailModal({ task, onClose, onSaved, onNotify, getOriginRect }) {
  const { stepsView } = useSettings()
  const [draft, setDraft] = useState(() => draftFrom(task))
  const [saveState, setSaveState] = useState(null) // null | 'saving' | 'saved' | 'error'
  const [editing, setEditing] = useState(false)
  const [allDonePrompt, setAllDonePrompt] = useState(false)
  const cardRef = useRef(null)
  const contentRef = useRef(null)
  const scrimRef = useRef(null)
  const doneButtonRef = useRef(null)
  const closing = useRef(false)

  // Switching to a different task resets the draft.
  useEffect(() => {
    setDraft(draftFrom(task))
    setSaveState(null)
    setEditing(false)
    setAllDonePrompt(false)
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

  // Esc closes the step editor first, then the card.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (editing) setEditing(false)
      else requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function run(request) {
    setSaveState('saving')
    try {
      const updated = await request()
      setSaveState('saved')
      onSaved?.(updated)
      return updated
    } catch {
      setSaveState('error')
      return null
    }
  }

  const save = (changes) => run(() => patchTask(task.id, changes))

  async function setStatus(status, buttonEl) {
    if (status === task.status) return
    const forward = STATUS_ORDER[status] > STATUS_ORDER[task.status]
    const rect = buttonEl?.getBoundingClientRect()
    setAllDonePrompt(false)
    const updated = await save({ status })
    if (updated && forward) celebrate(rect, status === 'done' ? 'done' : 'move')
  }

  async function onComplete(step, buttonEl) {
    const before = task
    celebrate(buttonEl.getBoundingClientRect(), 'step')
    const updated = await run(() => completeStep(task.id, step.id))
    if (!updated) return
    if (currentStepIndex(updated) < 0 && updated.status !== 'done') setAllDonePrompt(true)
    if (before.status === 'todo' && updated.status === 'in_progress') {
      onNotify?.('Step done. Moved to In progress', async () => {
        await undoStep(task.id, step.id)
        onSaved?.(await patchTask(task.id, { status: 'todo' }))
      })
    }
  }

  async function onUndo(step) {
    setAllDonePrompt(false)
    await run(() => undoStep(task.id, step.id))
  }

  async function onMoveToDone() {
    setAllDonePrompt(false)
    const updated = await save({ status: 'done' })
    // The prompt is gone now, so burst from the Done status that just lit up.
    if (updated) requestAnimationFrame(() => celebrate(doneButtonRef.current?.getBoundingClientRect(), 'done'))
  }

  async function onSaveSteps(list) {
    const updated = await run(() => replaceSteps(task.id, list))
    if (updated) setEditing(false)
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

  const total = task.steps.length
  const done = doneStepCount(task)
  const StepsView = stepsView === 'timeline' ? StepTimeline : StepStepper

  return (
    <div className="modal-root">
      <div className="modal-scrim" ref={scrimRef} onMouseDown={() => (editing ? setEditing(false) : requestClose())} />
      <div
        className="task-modal"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        tabIndex={-1}
      >
        <div className="task-modal-content" ref={contentRef} inert={editing ? '' : undefined}>
          <header className="task-modal-header">
            <span className="task-modal-crumb">
              {task.story_title ? `${task.story_title} · ${task.epic_name}` : 'Not part of a story'}
            </span>
            <button className="task-modal-close" onClick={requestClose} aria-label="Close">
              ×
            </button>
          </header>

          <input className="task-modal-title" aria-label="Title" {...bind('title')} />

          <div className="task-modal-row">
            <div className="status-pick" role="group" aria-label="Status">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  ref={s === 'done' ? doneButtonRef : undefined}
                  className={`status-pick-item${task.status === s ? ' active' : ''}`}
                  aria-pressed={task.status === s}
                  onClick={(e) => setStatus(s, e.currentTarget)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <label className="estimate-field">
              <input type="number" min="1" aria-label="Estimate in minutes" {...bind('est_minutes')} />
              <span>min</span>
            </label>
          </div>

          <section className="steps-section" aria-label="Steps">
            <div className="steps-head">
              <span className="steps-title">Steps</span>
              <span className="progress-bar">
                <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </span>
              <small>
                {done} of {total} done
              </small>
              <button className="edit-steps-button" onClick={() => setEditing(true)}>
                ✎ Edit steps
              </button>
            </div>

            <StepsView
              key={stepsView}
              task={task}
              onComplete={onComplete}
              onUndo={onUndo}
              keyboard={!editing}
            />

            {allDonePrompt && (
              <div className="all-done-prompt">
                <span>That was the last step. Move this task to Done?</span>
                <button className="primary-button" onClick={onMoveToDone}>
                  Move to Done
                </button>
                <button className="link-button" onClick={() => setAllDonePrompt(false)}>
                  Not yet
                </button>
              </div>
            )}
          </section>

          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              className="field-input field-textarea"
              rows={4}
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

        {editing && (
          <StepEditor
            task={task}
            saving={saveState === 'saving'}
            onCancel={() => setEditing(false)}
            onSave={onSaveSteps}
          />
        )}
      </div>
    </div>
  )
}
