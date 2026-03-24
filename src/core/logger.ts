import type { ConsolePayload, LogLevel } from '../types'

const COLORS = {
  reset: '\x1B[0m',
  red: '\x1B[31m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  gray: '\x1B[90m',
  bold: '\x1B[1m',
} as const

const LEVEL_COLORS: Record<LogLevel, string> = {
  log: COLORS.reset,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
}

export function printLog(payload: ConsolePayload, prefix: string): void {
  const color = LEVEL_COLORS[payload.type]
  const header = `${color}${COLORS.bold}[${prefix}][${payload.source}][${payload.type}]${COLORS.reset}`
  const message = payload.args.join(' ')
  const time = new Date(payload.timestamp).toLocaleTimeString()

  const lines = [
    `${header} ${COLORS.gray}${time}${COLORS.reset}`,
    `${color}message: ${message}${COLORS.reset}`,
  ]

  if (payload.stack) {
    const stackLines = payload.stack
      .split('\n')
      .filter(l => l.trim())
      .slice(0, 5)
      .join('\n')
    lines.push(`${COLORS.gray}stack: ${stackLines}${COLORS.reset}`)
  }

  const output = lines.join('\n')

  switch (payload.type) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'info':
      // eslint-disable-next-line no-console
      console.info(output)
      break
    default:
      // eslint-disable-next-line no-console
      console.log(output)
  }
}
