import { useEffect, useState } from 'react'
import TaskDetailPanel from '../components/TaskDetailPanel.jsx'
import { STATUSES, STATUS_LABELS, patchTask } from '../tasks.js'

// REC-27: kanban board. Tasks come from /api/board; dragging a card between
// columns PATCHes its status, clicking one opens the detail panel.
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

  async function moveTask(id, status) {
    const before = tasks.find((t) => t.id === id)
    if (!before || before.status === status) return
    replaceTask({ ...before, status }) // optimistic
    setError(null)
    try {
      replaceTask(await patchTask(id, { status }))
    } catch {
      replaceTask(before)
      setError("Couldn't move that card — is the backend running?")
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

            <label className="habit-toggle" title="Habit cards arrive with habit occurrences">
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
                    selected={t.id === selectedId}
                    onClick={() => setSelectedId(t.id)}
                  />
                ))}
                {cards.length === 0 && <div className="drop-hint">drag cards here</div>}
              </section>
            )
          })}
        </div>
      </div>

      {selected && (
        <TaskDetailPanel
          task={selected}
          onClose={() => setSelectedId(null)}
          onSaved={replaceTask}
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

function TaskCard({ task, selected, onClick }) {
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

  return (
    <div
      className={`task-card ${task.status}${selected ? ' selected' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(task.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
    >
      <p className="card-title">{task.title}</p>
      <p className="card-meta">{meta.filter(Boolean).join(' · ')}</p>
      {task.status === 'in_progress' && task.first_action && (
        <p className="card-first">First: {task.first_action}</p>
      )}
    </div>
  )
}
