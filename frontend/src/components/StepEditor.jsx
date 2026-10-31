import { useEffect, useRef, useState } from 'react'

// REC-30: step editor, opened from "Edit steps" over the task card. Steps are
// bubbles: hold and drag to reorder, click the text to rename, × to delete,
// and add at the bottom. Finished steps are locked at the top (history).
// Nothing is saved until Save; Cancel (or Esc, handled by the modal) drops it.
//
// Props: task, saving (bool), onCancel(), onSave([{ id?, text }])
const HOLD_MS = 200
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

let nextKey = 0
const withKey = (s) => ({ ...s, key: s.id ?? `new-${nextKey++}` })

export default function StepEditor({ task, saving, onCancel, onSave }) {
  const done = task.steps.filter((s) => s.done_at)
  const [list, setList] = useState(() => task.steps.filter((s) => !s.done_at).map(withKey))
  const [renaming, setRenaming] = useState(null) // key of the bubble being renamed
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState('')
  const listRef = useRef(null)
  const panelRef = useRef(null)
  const addRef = useRef(null)
  const focusAfter = useRef(null)

  useEffect(() => {
    if (!reducedMotion()) {
      panelRef.current?.animate(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
    }
  }, [])

  // After a keyboard move, keep focus on the moved bubble.
  useEffect(() => {
    if (focusAfter.current == null) return
    listRef.current?.querySelector(`[data-key="${focusAfter.current}"]`)?.focus()
    focusAfter.current = null
  })

  function move(from, to) {
    setList((prev) => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  function startRename(item) {
    setRenaming(item.key)
    setDraft(item.text)
  }

  function commitRename() {
    const text = draft.trim()
    if (text) setList((prev) => prev.map((s) => (s.key === renaming ? { ...s, text } : s)))
    setRenaming(null)
  }

  // Hold-and-drag with pointer events: a quick click renames instead.
  function onPointerDown(e, index) {
    if (e.button !== 0 || e.target.closest('.bubble-delete, .bubble-input')) return
    e.preventDefault()
    const listEl = listRef.current
    const items = [...listEl.querySelectorAll('.bubble:not(.locked)')]
    const el = items[index]
    const rects = items.map((n) => n.getBoundingClientRect())
    const gap = items.length > 1 ? rects[1].top - rects[0].bottom : 8
    const shiftBy = rects[index].height + gap
    const startY = e.clientY
    let lastY = startY
    let dragging = false
    let to = index

    const lift = () => {
      dragging = true
      el.classList.add('lifted')
      items.forEach((n) => n !== el && n.classList.add('shifting'))
      el.style.transform = `translateY(${lastY - startY}px) scale(1.02)`
    }
    const hold = setTimeout(lift, HOLD_MS)
    listEl.setPointerCapture(e.pointerId)

    const onMove = (ev) => {
      lastY = ev.clientY
      const dy = ev.clientY - startY
      if (!dragging && Math.abs(dy) > 4) {
        clearTimeout(hold)
        lift()
      }
      if (!dragging) return
      el.style.transform = `translateY(${dy}px) scale(1.02)`
      const center = rects[index].top + rects[index].height / 2 + dy
      to = rects.reduce((n, r, k) => (k !== index && center > r.top + r.height / 2 ? n + 1 : n), 0)
      items.forEach((n, k) => {
        if (k === index) return
        let shift = 0
        if (index < to && k > index && k <= to) shift = -shiftBy
        if (to < index && k >= to && k < index) shift = shiftBy
        n.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    }
    const onUp = () => {
      clearTimeout(hold)
      listEl.removeEventListener('pointermove', onMove)
      listEl.removeEventListener('pointerup', onUp)
      listEl.removeEventListener('pointercancel', onUp)
      if (!dragging) return startRename(list[index])
      const offset = to > index ? rects[to].bottom - rects[index].bottom : rects[to].top - rects[index].top
      el.classList.add('settling')
      el.style.transform = `translateY(${offset}px)`
      setTimeout(() => {
        items.forEach((n) => {
          n.style.transform = ''
          n.classList.remove('lifted', 'shifting', 'settling')
        })
        move(index, to)
      }, 160)
    }
    listEl.addEventListener('pointermove', onMove)
    listEl.addEventListener('pointerup', onUp)
    listEl.addEventListener('pointercancel', onUp)
  }

  function onBubbleKey(e, index) {
    if (e.target.closest('.bubble-input')) return
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const to = index + (e.key === 'ArrowUp' ? -1 : 1)
      if (to < 0 || to >= list.length) return
      focusAfter.current = list[index].key
      move(index, to)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      startRename(list[index])
    }
  }

  function add(e) {
    e.preventDefault()
    const text = adding.trim()
    if (!text) return
    setList((prev) => [...prev, withKey({ text })])
    setAdding('')
    addRef.current?.focus() // keep typing the next step after clicking ✓
    requestAnimationFrame(() => {
      const l = listRef.current
      if (l) l.scrollTop = l.scrollHeight
    })
  }

  return (
    <div className="step-editor" ref={panelRef} role="dialog" aria-label="Edit steps">
      <header className="step-editor-head">
        <h3>Edit steps</h3>
        <p>Hold and drag to reorder · click text to rename</p>
      </header>

      <ol className="bubble-list" ref={listRef}>
        {done.map((s) => (
          <li key={s.id} className="bubble locked">
            <span className="bubble-num">✓</span>
            <span className="bubble-text">{s.text}</span>
            <span className="bubble-tag">done</span>
          </li>
        ))}
        {list.map((s, i) => (
          <li
            key={s.key}
            data-key={s.key}
            className={`bubble${i === 0 ? ' is-current' : ''}`}
            tabIndex={0}
            aria-label={`Step ${done.length + i + 1}: ${s.text}. Alt+arrow keys to move, Enter to rename.`}
            onPointerDown={(e) => onPointerDown(e, i)}
            onKeyDown={(e) => onBubbleKey(e, i)}
          >
            <span className="bubble-grip" aria-hidden="true">⠿</span>
            <span className="bubble-num">{done.length + i + 1}</span>
            {renaming === s.key ? (
              <input
                className="bubble-input"
                autoFocus
                value={draft}
                aria-label="Step text"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    e.stopPropagation() // revert the rename only, keep the editor open
                    setRenaming(null)
                  }
                }}
              />
            ) : (
              <span className="bubble-text">{s.text}</span>
            )}
            {i === 0 && renaming !== s.key && <span className="bubble-tag">current</span>}
            <button
              className="bubble-delete"
              aria-label={`Delete step “${s.text}”`}
              onClick={() => setList((prev) => prev.filter((x) => x.key !== s.key))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <form className="bubble-add" onSubmit={add}>
        <input
          ref={addRef}
          placeholder="+ Add a step"
          aria-label="Add a step"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        />
        {adding.trim() && (
          <button type="submit" className="bubble-add-confirm" aria-label="Add step" title="Add step">
            ✓
          </button>
        )}
      </form>

      <footer className="step-editor-foot">
        <button className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={saving}
          onClick={() => onSave(list.map(({ id, text }) => (id ? { id, text } : { text })))}
        >
          {saving ? 'Saving…' : 'Save steps'}
        </button>
      </footer>
    </div>
  )
}
