import { NavLink, Routes, Route } from 'react-router-dom'
import Board from './pages/Board.jsx'
import Coach from './pages/Coach.jsx'
import Placeholder from './pages/Placeholder.jsx'
import Settings from './pages/Settings.jsx'
import { useTheme } from './theme.js'

// REC-6: app shell — sidebar nav + routed pages.
// Coach is the primary (chat) view; the other tabs are placeholders
// that get built in their own stories (Today, Identity, Progress).
const NAV_ITEMS = [
  { to: '/', label: 'Coach', icon: '💬', end: true },
  { to: '/today', label: 'Today', icon: '☀️' },
  { to: '/board', label: 'Board', icon: '🗂️' },
  { to: '/identity', label: 'Identity', icon: '🎯' },
  { to: '/progress', label: 'Progress', icon: '📈' },
]

export default function App() {
  const [theme, toggleTheme] = useTheme()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◎</span>
          <span className="brand-name">Recenter</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item nav-settings${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">⚙️</span>
          Settings
        </NavLink>
        <label className="toggle theme-toggle">
          <span className="nav-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
          Dark mode
          <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
          <span className="switch" aria-hidden="true" />
        </label>
        <div className="streak-card">
          <p className="streak-label">Current streak</p>
          <p className="streak-value">— days</p>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Coach />} />
          <Route
            path="/today"
            element={
              <Placeholder
                title="Today"
                note="Your daily habit stack and first small action will live here."
              />
            }
          />
          <Route path="/board" element={<Board />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/identity"
            element={
              <Placeholder
                title="Identity"
                note="Who you're becoming, and the habits that vote for it."
              />
            }
          />
          <Route
            path="/progress"
            element={
              <Placeholder
                title="Progress"
                note="Streaks, heatmaps, and trends will live here."
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}
