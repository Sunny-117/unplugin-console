import type { UnpluginContextMeta, UnpluginOptions } from 'unplugin'
import type { ConsolePayload, LogLevel } from '../src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { printLog } from '../src/core/logger'
import { ENDPOINT, generateRuntimeCode, WS_EVENT } from '../src/core/runtime'
import { unpluginFactory } from '../src/index'

const mockMeta: UnpluginContextMeta = {
  framework: 'vite',
}

function createPlugin(options: Parameters<typeof unpluginFactory>[0]): UnpluginOptions {
  const result = unpluginFactory(options, mockMeta)
  return Array.isArray(result) ? result[0] : result
}

// ─── Runtime code generation ──────────────────────────────────

describe('generateRuntimeCode', () => {
  it('should return a non-empty string', () => {
    const code = generateRuntimeCode(['log', 'info', 'warn', 'error'])
    expect(code).toBeTruthy()
    expect(typeof code).toBe('string')
  })

  it('should include the specified log levels', () => {
    const code = generateRuntimeCode(['log', 'error'])
    expect(code).toContain(JSON.stringify(['log', 'error']))
  })

  it('should include the endpoint', () => {
    const code = generateRuntimeCode(['log'])
    expect(code).toContain(ENDPOINT)
  })

  it('should include the WS event name', () => {
    const code = generateRuntimeCode(['log'])
    expect(code).toContain(WS_EVENT)
  })

  it('should contain console interception logic', () => {
    const code = generateRuntimeCode(['log', 'info', 'warn', 'error'])
    expect(code).toContain('console.log')
    expect(code).toContain('console.info')
    expect(code).toContain('console.warn')
    expect(code).toContain('console.error')
  })

  it('should contain safe stringify function', () => {
    const code = generateRuntimeCode(['log'])
    expect(code).toContain('_safeStringify')
    expect(code).toContain('[Circular]')
  })

  it('should contain fetch fallback', () => {
    const code = generateRuntimeCode(['log'])
    expect(code).toContain('fetch')
    expect(code).toContain('POST')
  })

  it('should wrap code in IIFE', () => {
    const code = generateRuntimeCode(['log'])
    expect(code).toContain(';(function()')
    expect(code).toContain('})();')
  })
})

// ─── Logger ──────────────────────────────────────────────────

describe('printLog', () => {
  let consoleSpy: Record<string, ReturnType<typeof vi.spyOn>>

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createPayload = (type: LogLevel, message: string): ConsolePayload => ({
    type,
    args: [message],
    timestamp: Date.now(),
    source: 'browser',
    stack: '',
  })

  it('should output log messages via console.log', () => {
    printLog(createPayload('log', 'test message'), 'test-prefix')
    expect(consoleSpy.log).toHaveBeenCalled()
    const output = consoleSpy.log.mock.calls[0][0] as string
    expect(output).toContain('test-prefix')
    expect(output).toContain('test message')
  })

  it('should output info messages via console.info', () => {
    printLog(createPayload('info', 'info msg'), 'test')
    expect(consoleSpy.info).toHaveBeenCalled()
    const output = consoleSpy.info.mock.calls[0][0] as string
    expect(output).toContain('info')
  })

  it('should output warn messages via console.warn', () => {
    printLog(createPayload('warn', 'warn msg'), 'test')
    expect(consoleSpy.warn).toHaveBeenCalled()
    const output = consoleSpy.warn.mock.calls[0][0] as string
    expect(output).toContain('warn')
  })

  it('should output error messages via console.error', () => {
    printLog(createPayload('error', 'error msg'), 'test')
    expect(consoleSpy.error).toHaveBeenCalled()
    const output = consoleSpy.error.mock.calls[0][0] as string
    expect(output).toContain('error')
  })

  it('should include stack trace when present', () => {
    const payload = createPayload('error', 'error with stack')
    payload.stack = 'at foo (bar.ts:1:2)\nat baz (qux.ts:3:4)'
    printLog(payload, 'test')
    expect(consoleSpy.error).toHaveBeenCalled()
    const output = consoleSpy.error.mock.calls[0][0] as string
    expect(output).toContain('stack:')
  })

  it('should include prefix in output', () => {
    printLog(createPayload('log', 'hello'), 'my-prefix')
    const output = consoleSpy.log.mock.calls[0][0] as string
    expect(output).toContain('my-prefix')
  })

  it('should include browser source label', () => {
    printLog(createPayload('log', 'hello'), 'test')
    const output = consoleSpy.log.mock.calls[0][0] as string
    expect(output).toContain('browser')
  })
})

// ─── Plugin factory ──────────────────────────────────────────

describe('unpluginFactory', () => {
  it('should create a plugin with correct name', () => {
    const plugin = createPlugin({})
    expect(plugin.name).toBe('unplugin-console')
  })

  it('should return minimal plugin when disabled', () => {
    const plugin = createPlugin({ enabled: false })
    expect(plugin.name).toBe('unplugin-console')
    expect(plugin.transform).toBeUndefined()
    expect(plugin.resolveId).toBeUndefined()
  })

  it('should resolve virtual module id', () => {
    const plugin = createPlugin({ enabled: true })
    const resolveId = plugin.resolveId as ((id: string) => string | undefined) | undefined
    if (resolveId) {
      const result = resolveId('virtual:unplugin-console')
      expect(result).toBe('\0virtual:unplugin-console')
    }
  })

  it('should not resolve non-virtual module ids', () => {
    const plugin = createPlugin({ enabled: true })
    const resolveId = plugin.resolveId as ((id: string) => string | undefined) | undefined
    if (resolveId) {
      const result = resolveId('./some-module')
      expect(result).toBeUndefined()
    }
  })

  it('should load virtual module with runtime code', () => {
    const plugin = createPlugin({ enabled: true })
    const load = plugin.load as ((id: string) => string | undefined) | undefined
    if (load) {
      const result = load('\0virtual:unplugin-console')
      expect(result).toBeTruthy()
      expect(result).toContain('_safeStringify')
    }
  })

  it('should not load non-virtual modules', () => {
    const plugin = createPlugin({ enabled: true })
    const load = plugin.load as ((id: string) => string | undefined) | undefined
    if (load) {
      const result = load('./other.ts')
      expect(result).toBeUndefined()
    }
  })

  it('should match default entry files', () => {
    const plugin = createPlugin({ enabled: true })
    const transformInclude = plugin.transformInclude as ((id: string) => boolean) | undefined
    if (transformInclude) {
      expect(transformInclude('/project/src/main.ts')).toBe(true)
      expect(transformInclude('/project/src/main.js')).toBe(true)
      expect(transformInclude('/project/src/index.ts')).toBe(true)
    }
  })

  it('should not match non-entry files', () => {
    const plugin = createPlugin({ enabled: true })
    const transformInclude = plugin.transformInclude as ((id: string) => boolean) | undefined
    if (transformInclude) {
      expect(transformInclude('/project/src/utils.ts')).toBe(false)
      expect(transformInclude('/project/src/component.vue')).toBe(false)
    }
  })

  it('should match custom entry files', () => {
    const plugin = createPlugin({ enabled: true, entry: ['app.ts'] })
    const transformInclude = plugin.transformInclude as ((id: string) => boolean) | undefined
    if (transformInclude) {
      expect(transformInclude('/project/src/app.ts')).toBe(true)
    }
  })

  it('should inject virtual module import in transform', () => {
    const plugin = createPlugin({ enabled: true })
    const transform = plugin.transform as ((code: string, id: string) => { code: string } | undefined) | undefined
    if (transform) {
      const result = transform('const x = 1', '/project/main.ts')
      expect(result?.code).toContain('import \'virtual:unplugin-console\'')
      expect(result?.code).toContain('const x = 1')
    }
  })

  it('should use custom levels', () => {
    const plugin = createPlugin({ enabled: true, levels: ['error'] })
    const load = plugin.load as ((id: string) => string | undefined) | undefined
    if (load) {
      const code = load('\0virtual:unplugin-console')
      expect(code).toContain(JSON.stringify(['error']))
    }
  })
})

// ─── Constants ───────────────────────────────────────────────

describe('constants', () => {
  it('endpoint should be a valid path', () => {
    expect(ENDPOINT).toBe('/__unplugin_console')
  })

  it('ws event should be a namespaced event', () => {
    expect(WS_EVENT).toContain('unplugin-console')
  })
})
