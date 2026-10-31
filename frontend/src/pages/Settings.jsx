import { useRef } from 'react'
import { bump, celebrate } from '../fx.js'
import { FX_SECONDS, updateSettings, useSettings } from '../settings.js'

// REC-30: user preferences. Saved per browser (see settings.js).
const VIEWS = [
  { value: 'stepper', label: 'Stepper', pic: <span className="pic pic-stepper"><i /><i /><i /></span> },
  { value: 'timeline', label: 'Timeline', pic: <span className="pic pic-timeline"><i /><i /><i /></span> },
]
const STYLES = [
  { value: 'confetti', label: 'Confetti', icon: '🎊' },
  { value: 'sparks', label: 'Sparks', icon: '✨' },
  { value: 'popper', label: 'Popper + cheer', icon: '🎉' },
  { value: 'off', label: 'Off', icon: '○' },
]

export default function Settings() {
  const settings = useSettings()
  const previewRef = useRef(null)

  function preview() {
    const card = previewRef.current
    if (!card) return
    bump(card)
    celebrate(card.getBoundingClientRect(), 'done', { around: true })
  }

  function pickStyle(fxStyle) {
    updateSettings({ fxStyle })
    preview() // reads the new style straight from the store
  }

  const off = settings.fxStyle === 'off'

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <span className="page-note">Remembered in this browser</span>
      </header>

      <div className="settings-body">
        <section className="settings-group">
          <h2 className="settings-group-title">Tasks</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-text">
                <p className="settings-name">Steps view</p>
                <p className="settings-desc">How a task's steps look when you open its card.</p>
              </div>
              <RadioCards
                label="Steps view"
                options={VIEWS}
                value={settings.stepsView}
                onChange={(stepsView) => updateSettings({ stepsView })}
              />
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">Celebrations</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-text">
                <p className="settings-name">Style</p>
                <p className="settings-desc">
                  What goes off when you finish a step, move a card forward, or finish a task.
                </p>
              </div>
              <RadioCards
                label="Celebration style"
                options={STYLES.map((s) => ({ ...s, pic: <span className="pic pic-fx">{s.icon}</span> }))}
                value={settings.fxStyle}
                onChange={pickStyle}
              />
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <p className="settings-name">Duration</p>
                <p className="settings-desc">How long each celebration lasts. Longer ones fall further.</p>
              </div>
              <div className={`duration-control${off ? ' off' : ''}`}>
                <input
                  type="range"
                  min={FX_SECONDS.min}
                  max={FX_SECONDS.max}
                  step={FX_SECONDS.step}
                  value={settings.fxSeconds}
                  disabled={off}
                  aria-label="Celebration duration in seconds"
                  onChange={(e) => updateSettings({ fxSeconds: Number(e.target.value) })}
                  onPointerUp={preview}
                  onKeyUp={(e) => e.key.startsWith('Arrow') && preview()}
                />
                <output>{settings.fxSeconds.toFixed(1)}s</output>
              </div>
            </div>

            <div className="settings-preview">
              <div className="task-card in_progress preview-card" ref={previewRef}>
                <p className="card-title">Preview card</p>
                <p className="card-meta">Your celebrations play here</p>
                <div className="card-action">
                  <button className="card-check" tabIndex={-1} aria-hidden="true" />
                  <span>
                    <b>Next action:</b> Try a style
                  </span>
                </div>
              </div>
              <button className="ghost-button" onClick={preview} disabled={off}>
                ▶ Preview
              </button>
              <p className="settings-desc">
                Changing the style or letting go of the slider plays a preview here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// A radio group drawn as picture cards. Arrow keys move the selection.
function RadioCards({ label, options, value, onChange }) {
  function onKeyDown(e) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    if (!(e.key in keys)) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + keys[e.key] + options.length) % options.length]
    onChange(next.value)
    e.currentTarget.querySelector(`[data-value="${next.value}"]`)?.focus()
  }

  return (
    <div className="radio-cards" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          data-value={o.value}
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="radio-card"
          onClick={() => onChange(o.value)}
        >
          {o.pic}
          {o.label}
        </button>
      ))}
    </div>
  )
}
