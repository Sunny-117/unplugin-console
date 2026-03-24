import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UnpluginFactory } from 'unplugin'
import type { ConsolePayload, Options } from './types'
import process from 'node:process'
import { createUnplugin } from 'unplugin'
import { printLog } from './core/logger'
import { ENDPOINT, generateRuntimeCode, WS_EVENT } from './core/runtime'
import { createLogServer } from './core/server'

const VIRTUAL_MODULE_ID = 'virtual:unplugin-console'
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MODULE_ID}`

const DEFAULT_ENTRY_PATTERNS = [
  'main.ts',
  'main.js',
  'main.tsx',
  'main.jsx',
  'index.ts',
  'index.js',
  'index.tsx',
  'index.jsx',
  'src/main.ts',
  'src/main.js',
  'src/main.tsx',
  'src/main.jsx',
  'src/index.ts',
  'src/index.js',
  'src/index.tsx',
  'src/index.jsx',
  'app.ts',
  'app.js',
  'app.tsx',
  'app.jsx',
]

const BACKSLASH_RE = /\\/g

function isEntryFile(id: string, patterns: string[]): boolean {
  const normalized = id.replace(BACKSLASH_RE, '/')
  return patterns.some(p => normalized.endsWith(p))
}

function handlePostRequest(req: IncomingMessage, res: ServerResponse, prefix: string): void {
  let body = ''
  req.on('data', (chunk: string) => {
    body += chunk.toString()
  })
  req.on('end', () => {
    try {
      const payload: ConsolePayload = JSON.parse(body)
      printLog(payload, prefix)
    }
    catch {
      // ignore malformed data
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end('{"ok":true}')
  })
}

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options, _meta) => {
  const {
    enabled = process.env.NODE_ENV !== 'production',
    levels = ['log', 'info', 'warn', 'error'],
    prefix = 'unplugin-console',
    serverPort = 8787,
    entry = DEFAULT_ENTRY_PATTERNS,
  } = options || {}

  if (!enabled) {
    return { name: 'unplugin-console' }
  }

  const runtimeCode = generateRuntimeCode(levels)
  let injected = false

  return {
    name: 'unplugin-console',

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID
      }
    },

    loadInclude(id) {
      return id === RESOLVED_VIRTUAL_ID
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        return runtimeCode
      }
    },

    transformInclude(id) {
      if (injected)
        return false
      return isEntryFile(id, entry)
    },

    transform(code, _id) {
      if (injected)
        return
      injected = true
      return `import '${VIRTUAL_MODULE_ID}';\n${code}`
    },

    // Vite-specific: use configureServer for HTTP middleware + HMR WebSocket
    vite: {
      configureServer(server) {
        // Listen for WebSocket messages via Vite HMR
        server.ws.on(WS_EVENT, (data: ConsolePayload) => {
          printLog(data, prefix)
        })

        // HTTP POST endpoint as fallback
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === ENDPOINT) {
            handlePostRequest(req, res, prefix)
            return
          }
          if (req.method === 'OPTIONS' && req.url === ENDPOINT) {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            })
            res.end()
            return
          }
          next()
        })
      },
    },

    // Webpack: create standalone log server in development
    webpack(compiler) {
      if (compiler.options.mode === 'development' || !compiler.options.mode) {
        let server: ReturnType<typeof createLogServer> | null = null
        compiler.hooks.afterEnvironment.tap('unplugin-console', () => {
          server = createLogServer(serverPort, prefix)
        })
        compiler.hooks.shutdown.tapAsync('unplugin-console', (callback) => {
          if (server) {
            server.close(() => callback())
          }
          else {
            callback()
          }
        })
      }
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
