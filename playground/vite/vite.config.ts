import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Unplugin from 'unplugin-console/vite'

export default defineConfig({
  server: {
    fs: {
      allow: [resolve(import.meta.dirname, '..')],
    },
  },
  plugins: [
    Inspect(),
    Unplugin({
      levels: ['log', 'info', 'warn', 'error'],
      prefix: 'unplugin-console',
    }),
  ],
})
