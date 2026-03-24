export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface Options {
  /**
   * Enable/disable the plugin
   * @default true in development, false in production
   */
  enabled?: boolean

  /**
   * Log levels to capture
   * @default ['log', 'info', 'warn', 'error']
   */
  levels?: LogLevel[]

  /**
   * Custom prefix for terminal output
   * @default 'unplugin-console'
   */
  prefix?: string

  /**
   * Port for standalone HTTP server (non-Vite bundlers)
   * @default 8787
   */
  serverPort?: number

  /**
   * Entry file patterns to inject runtime
   * @default ['main.ts', 'main.js', 'main.tsx', 'main.jsx', 'index.ts', 'index.js', 'index.tsx', 'index.jsx']
   */
  entry?: string[]
}

export interface ConsolePayload {
  type: LogLevel
  args: string[]
  timestamp: number
  source: 'browser'
  stack: string
}
