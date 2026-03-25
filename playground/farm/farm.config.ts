import { defineConfig } from '@farmfe/core'
import Unplugin from 'unplugin-console/farm'

export default defineConfig({
  plugins: [
    Unplugin({
      serverPort: 8787,
    }),
  ],
})
