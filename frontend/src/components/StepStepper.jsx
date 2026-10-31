import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { actionLabel, currentStepIndex, formatDoneAt } from '../tasks.js'

// REC-30: steps as cards in a horizontal strip with snap scrolling. Swipe or
// trackpad (native), drag with the mouse, side arrows, dots, or ←/→.
// Neighbouring steps peek in at the edges.
//
// Props: task, onComplete(step, buttonEl), onUndo(step), keyboard (bool:
// listen for ←/→, off while the step editor is open).
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export default function StepStepper({ task, onComplete, onUndo, keyboard = true }) {
  const steps = task.steps
  const cur = currentStepIndex(task)
  const [view, setView] = useState(cur >= 0 ? cur : steps.length - 1)
  const trackRef = useRef(null)
  const lastCur = useRef(cur)

  const slides = () => [...(trackRef.current?.querySelectorAll('.step-slide') ?? [])]

  function scrollToIndex(i, behavior = 'smooth') {
    const track = trackRef.current
    const slide = slides()[i]
    if (!track || !slide) return
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
      behavior: reducedMotion() ? 'instant' : behavior,
    })
  }

  function nearestIndex() {
    const track = trackRef.current
    const mid = track.scrollLeft + track.clientWidth / 2
    let best = 0
    let dist = Infinity
    slides().forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    return best
  }

  // Open on the current step.
  useLayoutEffect(() => {
    scrollToIndex(view, 'instant')
  }, [])

  // A step was completed (or undone): glide to the new current step.
  useEffect(() => {
    if (cur === lastCur.current) return
    lastCur.current = cur
    if (cur >= 0) requestAnimationFrame(() => scrollToIndex(cur))
  }, [cur])

  // Keep `view` in sync with wherever the strip has scrolled to. The strip only
  // exists when there are steps, so re-attach when that changes.
  const hasSteps = steps.length > 0
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setView(nearestIndex()))
    }
    track.addEventListener('scroll', onScroll)
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [hasSteps])

  useEffect(() => {
    if (!keyboard) return
    const onKey = (e) => {
      if (e.target.matches?.('input, textarea, select, [contenteditable]')) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const next = Math.max(0, Math.min(steps.length - 1, view + (e.key === 'ArrowRight' ? 1 : -1)))
      scrollToIndex(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Mouse drag to scroll, like swiping. Snap is paused while dragging, then
  // the strip glides to the nearest step.
  function onPointerDown(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return
    const track = trackRef.current
    const startX = e.clientX
    const startLeft = track.scrollLeft
    let moved = false
    track.setPointerCapture(e.pointerId)
    track.classList.add('dragging')
    const move = (ev) => {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 3) moved = true
      track.scrollLeft = startLeft - dx
    }
    const up = () => {
      track.removeEventListener('pointermove', move)
      track.removeEventListener('pointerup', up)
      track.removeEventListener('pointercancel', up)
      scrollToIndex(nearestIndex())
      const unsnap = () => track.classList.remove('dragging')
      track.addEventListener('scrollend', unsnap, { once: true })
      setTimeout(unsnap, 450)
      if (moved) {
        const swallow = (ce) => {
          ce.stopPropagation()
          ce.preventDefault()
        }
        track.addEventListener('click', swallow, { capture: true, once: true })
      }
    }
    track.addEventListener('pointermove', move)
    track.addEventListener('pointerup', up)
    track.addEventListener('pointercancel', up)
  }

  if (!steps.length) return <p className="steps-empty">No steps yet. Use Edit steps to add some.</p>

  return (
    <div className="stepper">
      <div className="stepper-dots-row">
        <div className="stepper-dots">
          {steps.map((s, i) => (
            <span key={s.id} className="stepper-dot-wrap">
              {i > 0 && <i className={`stepper-link${steps[i - 1].done_at ? ' done' : ''}`} />}
              <button
                className={`stepper-dot${s.done_at ? ' done' : i === cur ? ' current' : ''}${i === view ? ' viewing' : ''}`}
                aria-label={`Step ${i + 1}`}
                aria-current={i === view ? 'step' : undefined}
                onClick={() => scrollToIndex(i)}
              >
                {s.done_at ? '✓' : i + 1}
              </button>
            </span>
          ))}
        </div>
        {cur >= 0 && view !== cur && (
          <button className="link-button" onClick={() => scrollToIndex(cur)}>
            Back to current step
          </button>
        )}
      </div>

      <div className="stepper-carousel">
        <button
          className="stepper-arrow prev"
          aria-label="Previous step"
          disabled={view === 0}
          onClick={() => scrollToIndex(view - 1)}
        >
          ‹
        </button>
        <div className="stepper-track" ref={trackRef} onPointerDown={onPointerDown}>
          <div className="stepper-spacer" />
          {steps.map((s, i) => (
            <Slide
              key={s.id}
              task={task}
              step={s}
              index={i}
              cur={cur}
              viewing={i === view}
              onFocusSlide={() => i !== view && scrollToIndex(i)}
              onComplete={onComplete}
              onUndo={onUndo}
            />
          ))}
          <div className="stepper-spacer" />
        </div>
        <button
          className="stepper-arrow next"
          aria-label="Next step"
          disabled={view === steps.length - 1}
          onClick={() => scrollToIndex(view + 1)}
        >
          ›
        </button>
      </div>
    </div>
  )
}

function Slide({ task, step, index, cur, viewing, onFocusSlide, onComplete, onUndo }) {
  const n = task.steps.length
  const kind = step.done_at ? 'done' : index === cur ? 'current' : 'upcoming'
  const label =
    kind === 'done'
      ? `Step ${index + 1} of ${n} · Done ${formatDoneAt(step.done_at)}`
      : kind === 'current'
        ? `${actionLabel(task)} · Step ${index + 1} of ${n}`
        : `Step ${index + 1} of ${n} · Coming up`

  return (
    <div
      className={`step-slide ${kind}${viewing ? ' viewing' : ''}`}
      onClick={(e) => !e.target.closest('button') && onFocusSlide()}
    >
      <p className="step-label">{label}</p>
      <p className="step-text">{step.text}</p>
      <div className="step-foot">
        {kind === 'done' && (
          <button className="link-button" onClick={() => onUndo(step)}>
            Undo
          </button>
        )}
        {kind === 'current' && (
          <button className="primary-button" onClick={(e) => onComplete(step, e.currentTarget)}>
            ✓ Mark done
          </button>
        )}
        {kind === 'upcoming' && <span className="step-meta">After step {cur + 1}</span>}
      </div>
    </div>
  )
}
