import esbuild from 'esbuild'
import Unplugin from 'unplugin-console/esbuild'

const ctx = await esbuild.context({
  entryPoints: ['../shared/main.ts'],
  bundle: true,
  outdir: 'dist',
  plugins: [
    Unplugin({
      serverPort: 8787,
    }),
  ],
})

const { host, port } = await ctx.serve({
  servedir: '.',
  port: 8083,
})

console.log(`esbuild playground running at http://${host || 'localhost'}:${port}`)
