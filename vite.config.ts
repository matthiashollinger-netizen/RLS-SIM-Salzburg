/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base works on GitHub Pages under any repo name because the app
// uses a hash router (no server-side paths). See ANNAHMEN.md (M0).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // the WebLLM library chunk is huge but loads lazily on user opt-in only
    chunkSizeWarningLimit: 8000,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
})
