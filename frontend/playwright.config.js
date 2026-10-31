import { defineConfig } from '@playwright/test'

// Browser tests (regression suite). Playwright starts its own backend and
// frontend on separate ports, so a running dev setup (8000/5173) and your
// recenter.db are never touched:
//   backend  :8011  RECENTER_TESTING=1 → canned agent replies, /api/_test/reset
//                   throwaway DB at backend/e2e-test.db (gitignored)
//   frontend :5181  Vite, proxying /api to :8011
// RECENTER_PYTHON picks the interpreter (CI sets it to `python`).
const API_PORT = 8011
const WEB_PORT = 5181
const python = process.env.RECENTER_PYTHON || '.venv/bin/python'

export default defineConfig({
  testDir: 'e2e',
  workers: 1, // tests share one backend database
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1280, height: 820 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        RECENTER_TESTING: '1',
        RECENTER_DATABASE_URL: 'sqlite:///./e2e-test.db',
        RECENTER_CHECKPOINT_DB: './e2e-checkpoints.db',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { RECENTER_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
})
