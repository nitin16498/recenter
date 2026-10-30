import { useEffect, useState } from 'react'
import { STATUSES, STATUS_LABELS, patchTask } from '../tasks.js'

// REC-27: editable task detail panel. Standalone on purpose — the Board opens
// it first, REC-11's chat cards will open the same component.
//
// Props:
//   task    — a task as returned by /api/board or PATCH /api/tasks/{id}
//   onClose — close button handler
//   onSaved — called with the updated task after every successful save
//
// Edits save directly: text fields on blur, status on change.
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

export default function TaskDetailPanel({ task, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => draftFrom(task))
  const [saveState, setSaveState] = useState(null) // null | 'saving' | 'saved' | 'error'

  // Switching to a different task resets the draft.
  useEffect(() => {
    setDraft(draftFrom(task))
    setSaveState(null)
  }, [task.id])

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
    <aside className="task-panel">
      <header className="task-panel-header">
        <span>Task details</span>
        <button className="task-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className="task-panel-body">
        <label className="field">
          <span className="field-label">Title</span>
          <input className="field-input" {...bind('title')} />
        </label>

        <label className="field">
          <span className="field-label">First action</span>
          <input
            className="field-input"
            placeholder="The smallest physical step"
            {...bind('first_action')}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Estimate (min)</span>
            <input className="field-input" type="number" min="1" {...bind('est_minutes')} />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={task.status}
              onChange={(e) => save({ status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="field-label">Story</span>
          <p className="field-static">
            {task.story_title
              ? `${task.story_title} · epic: ${task.epic_name}`
              : 'Not part of a story'}
          </p>
        </div>

        <label className="field">
          <span className="field-label">Note</span>
          <textarea className="field-input field-textarea" rows={4} {...bind('note')} />
        </label>

        <p className="task-panel-footer">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && (
            <span className="task-panel-error">Couldn't save — is the backend running?</span>
          )}
          {saveState === null && 'Edits save directly.'}
        </p>
      </div>
    </aside>
  )
}
