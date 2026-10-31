import { useEffect, useLayoutEffect, useRef } from 'react'
import { actionLabel, currentStepIndex, formatDoneAt } from '../tasks.js'

// REC-30: every step in a vertical list, scrolled to the current one.
// Finished steps sit above it (scroll up for history), upcoming below.
// Clicking a finished step's check undoes it.
//
// Props: task, onComplete(step, buttonEl), onUndo(step).
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export default function StepTimeline({ task, onComplete, onUndo }) {
  const steps = task.steps
  const cur = currentStepIndex(task)
  const listRef = useRef(null)
  const lastCur = useRef(cur)

  function scrollToCurrent(behavior) {
    const list = listRef.current
    const item = list?.querySelector('.timeline-step.current') ?? list?.lastElementChild
    if (item) {
      list.scrollTo({
        top: Math.max(0, item.offsetTop - 40),
        behavior: reducedMotion() ? 'instant' : behavior,
      })
    }
  }

  useLayoutEffect(() => scrollToCurrent('instant'), [])

  useEffect(() => {
    if (cur === lastCur.current) return
    lastCur.current = cur
    scrollToCurrent('smooth')
  }, [cur])

  if (!steps.length) return <p className="steps-empty">No steps yet. Use Edit steps to add some.</p>

  return (
    <ol className="timeline" ref={listRef}>
      {steps.map((s, i) => {
        if (s.done_at) {
          return (
            <li key={s.id} className="timeline-step done">
              <button className="timeline-dot" onClick={() => onUndo(s)} title="Mark not done" aria-label={`Mark “${s.text}” not done`}>
                ✓
              </button>
              <div>
                <p className="timeline-text">{s.text}</p>
                <p className="step-meta">Done {formatDoneAt(s.done_at)}</p>
              </div>
            </li>
          )
        }
        if (i === cur) {
          return (
            <li key={s.id} className="timeline-step current">
              <span className="timeline-dot" />
              <div className="timeline-current">
                <p className="step-label">
                  {actionLabel(task)} · Step {i + 1} of {steps.length}
                </p>
                <p className="timeline-text">{s.text}</p>
                <button className="primary-button" onClick={(e) => onComplete(s, e.currentTarget)}>
                  ✓ Mark done
                </button>
              </div>
            </li>
          )
        }
        return (
          <li key={s.id} className="timeline-step upcoming">
            <span className="timeline-dot" />
            <p className="timeline-text">{s.text}</p>
          </li>
        )
      })}
    </ol>
  )
}
