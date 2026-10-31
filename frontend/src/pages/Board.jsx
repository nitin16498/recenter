import { useEffect, useRef, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import TaskDetailModal from '../components/TaskDetailModal.jsx'
import UndoToast from '../components/UndoToast.jsx'
import { bump, celebrate } from '../fx.js'
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_ORDER,
  actionLabel,
  completeStep,
  currentStepIndex,
  doneStepCount,
  patchTask,
  undoStep,
} from '../tasks.js'

// REC-27: kanban board. Tasks come from /api/board; dragging a card between
// columns PATCHes its status, clicking one expands it into the detail modal.
// REC-30: in-progress cards show the current step with a ring to tick it off;
// forward moves celebrate around the card (style/duration from Settings).
//
// Habit cards (kind === 'habit') are stubbed: the API returns tasks only until
// habit occurrences ship, but the toggle and card style are in place.
export default function Board() {
  const [tasks, setTasks] = useState([]) // flat list, server order
  const [epics, setEpics] = useState([])
  const [stories, setStories] = useState([])
  const [error, setError] = useState(null)

  const [epicId, setEpicId] = useState(null) // null = all
  const [storyId, setStoryId] = useState(null)
  const [showHabits, setShowHabits] = useState(true)

  const [selectedId, setSelectedId] = useState(null)
  const [dragOver, setDragOver] = useState(null) // status being hovered
  const [checking, setChecking] = useState(null) // task id whose ring is filling
  const [advanced, setAdvanced] = useState(null) // task id whose step just changed
  const [toast, setToast] = useState(null) // { id, message, undo }
  const toastSeq = useRef(0)

  useEffect(() => {
    fetch('/api/board')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((board) => {
        setTasks(STATUSES.flatMap((s) => board.columns[s] ?? []))
        setEpics(board.epics)
        setStories(board.stories)
      })
      .catch(() => setError('Backend not running — start uvicorn and refresh.'))
  }, [])

  function replaceTask(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function notify(message, undo) {
    setToast({ id: ++toastSeq.current, message, undo })
  }

  const cardEl = (id) => document.querySelector(`[data-task-id="${id}"]`)

  // Celebrate around the card once it has rendered in its new column.
  function celebrateCard(id, tier) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = cardEl(id)
        if (!el || el.classList.contains('expanded')) return
        bump(el)
        celebrate(el.getBoundingClientRect(), tier, { around: true })
      }),
    )
  }

  async function moveTask(id, status) {
    const before = tasks.find((t) => t.id === id)
    if (!before || before.status === status) return
    replaceTask({ ...before, status }) // optimistic
    if (STATUS_ORDER[status] > STATUS_ORDER[before.status]) {
      celebrateCard(id, status === 'done' ? 'done' : 'move')
    }
    setError(null)
    try {
      replaceTask(await patchTask(id, { status }))
    } catch {
      replaceTask(before)
      setError("Couldn't move that card — is the backend running?")
    }
  }

  // Tick the ring on a collapsed card: fill it, celebrate, then swap in the
  // next step once the server confirms.
  async function checkStep(task) {
    const i = currentStepIndex(task)
    if (i < 0 || checking) return
    const step = task.steps[i]
    setChecking(task.id)
    celebrate(cardEl(task.id)?.getBoundingClientRect(), 'step', { around: true })
    setError(null)
    try {
      const [updated] = await Promise.all([
        completeStep(task.id, step.id),
        new Promise((r) => setTimeout(r, 260)), // let the fill read before the swap
      ])
      replaceTask(updated)
      setAdvanced(task.id)
      setTimeout(() => setAdvanced((cur) => (cur === task.id ? null : cur)), 400)
      notify(`Done: ${step.text}`, async () => {
        try {
          replaceTask(await undoStep(task.id, step.id))
        } catch {
          setError("Couldn't undo — is the backend running?")
        }
      })
    } catch {
      setError("Couldn't save that step — is the backend running?")
    } finally {
      setChecking(null)
    }
  }

  function pickEpic(id) {
    setEpicId(id)
    setStoryId(null)
  }

  const storyChips = epicId ? stories.filter((s) => s.epic_id === epicId) : stories
  const visible = tasks.filter(
    (t) =>
      (epicId === null || t.epic_id === epicId) &&
      (storyId === null || t.story_id === storyId) &&
      (showHabits || t.kind !== 'habit'),
  )
  const selected = tasks.find((t) => t.id === selectedId)

  return (
    <div className="page board-page">
      <div className="board-main">
        <header className="board-header">
          <div className="board-title-row">
            <h1 className="board-title">Board</h1>
            <div className="segmented">
              <span className="segmented-item active">Kanban</span>
              <span className="segmented-item disabled" title="Coming soon">
                By story
              </span>
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-label">Epic:</span>
            <Chip active={epicId === null} onClick={() => pickEpic(null)}>
              All
            </Chip>
            {epics.map((e) => (
              <Chip key={e.id} active={epicId === e.id} onClick={() => pickEpic(e.id)}>
                {e.name}
              </Chip>
            ))}

            <label className="toggle habit-toggle" title="Habit cards arrive with habit occurrences">
              <span className="habit-icon">↻</span>
              Show habits
              <input
                type="checkbox"
                checked={showHabits}
                onChange={(e) => setShowHabits(e.target.checked)}
              />
              <span className="switch" aria-hidden="true" />
            </label>
          </div>

          {storyChips.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">Story:</span>
              <Chip active={storyId === null} onClick={() => setStoryId(null)}>
                All
              </Chip>
              {storyChips.map((s) => (
                <Chip key={s.id} active={storyId === s.id} onClick={() => setStoryId(s.id)}>
                  {s.title}
                </Chip>
              ))}
            </div>
          )}
        </header>

        {error && <p className="board-error">{error}</p>}

        <div className="board-columns">
          {STATUSES.map((status) => {
            const cards = visible.filter((t) => t.status === status)
            return (
              <section
                key={status}
                className={`board-column${dragOver === status ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(status)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(null)
                  const id = Number(e.dataTransfer.getData('text/plain'))
                  if (id) moveTask(id, status)
                }}
              >
                <p className="column-title">
                  {STATUS_LABELS[status].toUpperCase()} · {cards.length}
                </p>
                {cards.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    expanded={t.id === selectedId}
                    checking={t.id === checking}
                    advanced={t.id === advanced}
                    onClick={() => setSelectedId(t.id)}
                    onCheck={() => checkStep(t)}
                    onMoveToDone={() => moveTask(t.id, 'done')}
                  />
                ))}
                {cards.length === 0 && <div className="drop-hint">drag cards here</div>}
              </section>
            )
          })}
        </div>
      </div>

      {selected && (
        <ErrorBoundary
          key={selected.id}
          onError={() => {
            setSelectedId(null)
            setError('Something went wrong opening that card. Refresh and try again.')
          }}
        >
          <TaskDetailModal
            task={selected}
            onClose={() => setSelectedId(null)}
            onSaved={replaceTask}
            onNotify={notify}
            getOriginRect={() =>
              document.querySelector(`[data-task-id="${selected.id}"]`)?.getBoundingClientRect()
            }
          />
        </ErrorBoundary>
      )}

      {toast && (
        <UndoToast
          id={toast.id}
          message={toast.message}
          onUndo={toast.undo}
          onDismiss={() => setToast((cur) => (cur?.id === toast.id ? null : cur))}
        />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button className={`chip${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function TaskCard({ task, expanded, checking, advanced, onClick, onCheck, onMoveToDone }) {
  if (task.kind === 'habit') {
    return (
      <div className="task-card habit">
        <p className="card-title">
          <span className="habit-icon">↻</span> {task.title}
        </p>
        <p className="card-meta">habit · {task.trigger_slot}</p>
      </div>
    )
  }

  const meta = [task.story_title ?? 'No story', task.epic_name]
  if (task.status !== 'done' && task.est_minutes) meta.push(`${task.est_minutes}m`)
  const i = currentStepIndex(task)
  const total = task.steps.length
  const done = doneStepCount(task)
  const step = task.steps[i]

  return (
    <div
      className={`task-card ${task.status}${expanded ? ' expanded' : ''}`}
      data-task-id={task.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(task.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
    >
      <p className="card-title">{task.title}</p>
      <p className="card-meta">{meta.filter(Boolean).join(' · ')}</p>
      {task.status === 'in_progress' && step && (
        <div className={`card-action${advanced ? ' enter' : ''}`} key={step.id}>
          <button
            className={`card-check${checking ? ' checking' : ''}`}
            aria-label={`Mark “${step.text}” done`}
            title="Mark done"
            onClick={(e) => {
              e.stopPropagation()
              onCheck()
            }}
          >
            ✓
          </button>
          <span>
            <b>{actionLabel(task)}:</b> {step.text}
          </span>
        </div>
      )}
      {task.status === 'in_progress' && !step && total > 0 && (
        <div className="card-action all-done">
          <span>
            <b>All steps done</b>
          </span>
          <button
            className="link-button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveToDone()
            }}
          >
            Move to Done
          </button>
        </div>
      )}
      {task.status !== 'done' && done > 0 && (
        <div className="card-progress">
          <span className="progress-bar">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </span>
          <small>
            {done}/{total}
          </small>
        </div>
      )}
    </div>
  )
}
