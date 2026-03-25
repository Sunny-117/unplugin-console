import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import css from 'rollup-plugin-css-only'
import Unplugin from 'unplugin-console/rollup'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

export default {
  input: '../shared/main.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
  },
  plugins: [
    resolve(),
    css({ output: 'bundle.css' }),
    typescript({
      tsconfig: './tsconfig.json',
      include: ['../shared/**/*.ts'],
    }),
    Unplugin({
      serverPort: 8787,
    }),
    serve({ contentBase: '.', port: 8082 }),
    livereload('.'),
  ],
}
