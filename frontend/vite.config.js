import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api requests to the FastAPI backend during development,
// so the frontend can call fetch('/api/...') without CORS issues.
// RECENTER_API_URL lets the browser tests point at their own isolated backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.RECENTER_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // Unit tests (Vitest). Browser tests live in e2e/ and run with Playwright.
  test: {
    include: ['src/**/*.test.js'],
  },
})
