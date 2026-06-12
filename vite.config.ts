/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// App version for the footer identity (declared in src/vite-env.d.ts).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// Relative base works on GitHub Pages under any repo name because the app
// uses a hash router (no server-side paths). See ANNAHMEN.md (M0).
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    // the WebLLM library chunk is huge but loads lazily on user opt-in only
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        // Keep the map library out of the lazy GamePage chunk so both can
        // load in parallel (HomePage warms them up while the menu is open).
        // Function form on purpose: the object form hoists maplibre's CJS
        // interop helpers into the entry graph, loading the 1 MB chunk
        // eagerly at app start.
        manualChunks(id: string) {
          // shared rollup CJS interop helpers must NOT land inside the
          // maplibre chunk — the entry would then preload the whole 1 MB
          if (id.includes('commonjsHelpers') || id.includes('commonjs-external')) {
            return 'cjs-helpers'
          }
          if (id.includes('node_modules/maplibre-gl/')) return 'maplibre-gl'
          return undefined
        },
      },
    },
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
