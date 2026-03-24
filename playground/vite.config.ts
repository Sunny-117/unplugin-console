import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Unplugin from '../src/vite'

export default defineConfig({
  plugins: [
    Inspect(),
    Unplugin({
      levels: ['log', 'info', 'warn', 'error'],
      prefix: 'unplugin-console',
    }),
  ],
})
