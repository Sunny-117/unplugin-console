# unplugin-console

[![NPM version](https://img.shields.io/npm/v/unplugin-console?color=a1b858&label=)](https://www.npmjs.com/package/unplugin-console)

A cross-bundler plugin that forwards browser `console.log / info / warn / error` to your dev-server terminal in real time.

Built with [unplugin](https://github.com/unjs/unplugin), supports **Vite / Webpack / Rspack**.

## Features

- **Real-time forwarding** — browser console output appears in your Node.js terminal instantly
- **AST call-site injection** — keeps browser DevTools log links on your source files (no runtime console override)
- **Vite HMR WebSocket** — zero-config, uses Vite's built-in WebSocket for optimal performance
- **HTTP fallback** — works with any bundler via `fetch` / `XMLHttpRequest`
- **Safe serialization** — handles circular references, `Error`, `Date`, `RegExp`, DOM elements, `BigInt`, `Symbol`
- **Color-coded output** — `log` default, `info` blue, `warn` yellow, `error` red
- **Stack traces** — captured and displayed in terminal
- **Production auto-disable** — automatically disabled when `NODE_ENV=production`
- **Log level filtering** — only capture the levels you care about
- **Custom prefix** — personalize terminal output labels

## Install

```bash
npm i unplugin-console -D
```

## Usage

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import UnpluginConsole from 'unplugin-console/vite'

export default defineConfig({
  plugins: [
    UnpluginConsole({
      levels: ['log', 'info', 'warn', 'error'],
    }),
  ],
})
```

Example: [`playground/`](./playground/)

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
// webpack.config.js
const UnpluginConsole = require('unplugin-console/webpack')

module.exports = {
  plugins: [
    UnpluginConsole({
      serverPort: 8787, // standalone log server port
    }),
  ],
}
```

<br></details>

<details>
<summary>Vue CLI</summary><br>

```ts
// vue.config.js
module.exports = {
  configureWebpack: {
    plugins: [
      require('unplugin-console/webpack')({ /* options */ }),
    ],
  },
}
```

<br></details>

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` in dev, `false` in prod | Enable / disable the plugin |
| `levels` | `('log' \| 'info' \| 'warn' \| 'error')[]` | `['log', 'info', 'warn', 'error']` | Log levels to capture |
| `prefix` | `string` | `'unplugin-console'` | Custom prefix for terminal output |
| `serverPort` | `number` | `8787` | Port for standalone HTTP log server |
| `entry` | `string[]` | `['main.ts', 'main.js', 'index.ts', ...]` | Entry file patterns to preload runtime helper |
| `captureStack` | `boolean \| ('log' \| 'info' \| 'warn' \| 'error')[]` | `['warn', 'error']` | Controls which levels collect stack traces (`true` = all, `false` = none) |
| `stackTraceDepth` | `number` | `10` | Maximum stack frames kept per log when stack capture is enabled |

## Terminal Output

Logs appear in the terminal with color-coded formatting:

```
[unplugin-console][browser][log]   10:30:00
message: Hello from browser!

[unplugin-console][browser][warn]  10:30:01
message: Something looks off
stack: at handleClick (src/App.tsx:42:5)

[unplugin-console][browser][error] 10:30:02
message: Error: Something went wrong
stack: at fetchData (src/api.ts:15:11)
```

- `log` — default color
- `info` — blue
- `warn` — yellow
- `error` — red

## How It Works

```
Browser                          Dev Server (Node.js)
┌─────────────────┐              ┌─────────────────────┐
│  console.log()  │──┐           │                     │
│  console.info() │  │  WebSocket│  Receive payload    │
│  console.warn() │  ├──(HMR)──>│  ↓                  │
│  console.error()│  │  or HTTP  │  Color-coded print  │
│                 │  │  POST     │  to terminal        │
│  (original      │──┘           │                     │
│   output kept)  │              └─────────────────────┘
└─────────────────┘
```

1. **AST instrumentation** — during `transform`, `console.log/info/warn/error(...)` calls are rewritten in-place to add reporting without overriding `console`
2. **Runtime helper injection** — a virtual module (`virtual:unplugin-console`) is imported to register a global reporter function
3. **Transport** — Vite uses HMR WebSocket (`import.meta.hot.send`); other bundlers fall back to HTTP POST (`/__unplugin_console`)
4. **Terminal output** — the server receives payloads and prints them with ANSI color codes

Technical notes: [`docs/ast-instrumentation.md`](./docs/ast-instrumentation.md)

### Payload format

```json
{
  "type": "log | warn | error | info",
  "args": ["serialized", "arguments"],
  "timestamp": 1711234567890,
  "source": "browser",
  "stack": "at Component (src/App.tsx:10:5)\n..."
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run playground (Vite)
pnpm play

# Lint
pnpm lint
```

## License

[MIT](./LICENSE) License
