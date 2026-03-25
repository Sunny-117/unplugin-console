import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UnpluginFactory } from 'unplugin'
import type { ConsolePayload, LogLevel, Options } from './types'
import process from 'node:process'
import { createUnplugin } from 'unplugin'
import { printLog } from './core/logger'
import { instrumentConsoleCalls } from './core/instrument'
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
const QUERY_HASH_RE = /[?#].*$/
const SCRIPT_RE = /\.[cm]?[jt]sx?$/

function isEntryFile(id: string, patterns: string[]): boolean {
  const normalized = id.replace(BACKSLASH_RE, '/').replace(QUERY_HASH_RE, '')
  return patterns.some(p => normalized.endsWith(p))
}

function isTransformableScript(id: string): boolean {
  const normalized = id.replace(BACKSLASH_RE, '/').replace(QUERY_HASH_RE, '')
  if (normalized.includes('/node_modules/'))
    return false
  return SCRIPT_RE.test(normalized)
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

// Frameworks that manage their own log server via compiler hooks
const SELF_MANAGED_FRAMEWORKS = new Set(['vite', 'webpack', 'rspack'])

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options, meta) => {
  const {
    enabled = process.env.NODE_ENV !== 'production',
    levels = ['log', 'info', 'warn', 'error'],
    prefix = 'unplugin-console',
    serverPort = 8787,
    entry = DEFAULT_ENTRY_PATTERNS,
    captureStack = ['warn', 'error'],
    stackTraceDepth = 10,
  } = options || {}

  if (!enabled) {
    return { name: 'unplugin-console' }
  }

  const resolvedStackLevels: LogLevel[] = captureStack === true
    ? [...levels]
    : captureStack === false
      ? []
      : levels.filter(level => captureStack.includes(level))

  const resolvedStackTraceDepth = Number.isFinite(stackTraceDepth)
    ? Math.max(0, Math.floor(stackTraceDepth))
    : 10

  const runtimeCode = generateRuntimeCode(
    levels,
    serverPort,
    resolvedStackLevels,
    resolvedStackTraceDepth,
    meta.framework === 'vite',
  )
  let logServer: ReturnType<typeof createLogServer> | null = null

  return {
    name: 'unplugin-console',

    buildStart() {
      // For non self-managed frameworks, start standalone log server in buildStart.
      // Vite/Webpack/Rspack manage their own server via framework-specific hooks
      if (!SELF_MANAGED_FRAMEWORKS.has(meta.framework)) {
        logServer = createLogServer(serverPort, prefix)
      }
    },

    buildEnd() {
      if (logServer) {
        logServer.close()
        logServer = null
      }
    },

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
      if (id === RESOLVED_VIRTUAL_ID)
        return false
      return isTransformableScript(id)
    },

    transform(code, id) {
      let nextCode = code
      let changed = false

      const instrumented = instrumentConsoleCalls(nextCode, id, levels)
      if (instrumented) {
        nextCode = instrumented
        changed = true
      }

      const shouldInjectRuntime = isEntryFile(id, entry) || Boolean(instrumented)
      if (shouldInjectRuntime && !nextCode.includes(VIRTUAL_MODULE_ID)) {
        nextCode = `import '${VIRTUAL_MODULE_ID}';\n${nextCode}`
        changed = true
      }

      if (!changed)
        return

      return { code: nextCode }
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
      // Register virtual: scheme handler so webpack doesn't throw UnhandledSchemeError
      const NormalModule = compiler.webpack?.NormalModule ?? require('webpack').NormalModule
      compiler.hooks.compilation.tap('unplugin-console', (compilation, { normalModuleFactory }) => {
        normalModuleFactory.hooks.resolveForScheme
          .for('virtual')
          .tap('unplugin-console', (resourceData) => {
            // Mark the resource so webpack knows it's handled
            resourceData.path = resourceData.resource
            resourceData.query = ''
            resourceData.fragment = ''
            return true
          })

        NormalModule.getCompilationHooks(compilation)
          .readResourceForScheme.for('virtual')
          .tap('unplugin-console', () => {
            // Return the runtime code directly since webpack's scheme-based resolution
            // bypasses unplugin's load hook
            return Buffer.from(runtimeCode)
          })
      })

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

    // Rspack: create standalone log server in development
    rspack(compiler) {
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
