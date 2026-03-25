import type { LogLevel } from '../types'
import * as oxc from 'oxc-parser'

type Range = [number, number]

interface AstNode {
  type?: string
  name?: string
  computed?: boolean
  optional?: boolean
  range?: Range
  start?: number
  end?: number
  callee?: AstNode
  object?: AstNode
  property?: AstNode
  arguments?: AstNode[]
  [key: string]: unknown
}

export interface Replacement {
  start: number
  end: number
  code: string
}

const QUERY_HASH_RE = /[?#].*$/

function cleanId(id: string): string {
  return id.replace(QUERY_HASH_RE, '')
}

function isEnabledConsoleCall(node: AstNode, enabledLevels: Set<LogLevel>): node is AstNode {
  if (node.type !== 'CallExpression')
    return false
  if (node.optional)
    return false
  if (node.start === undefined || node.end === undefined)
    return false

  const callee = node.callee
  if (!callee || callee.type !== 'MemberExpression')
    return false
  if (callee.computed)
    return false
  if (!callee.object || callee.object.type !== 'Identifier' || callee.object.name !== 'console')
    return false
  if (!callee.property || callee.property.type !== 'Identifier' || !callee.property.name)
    return false

  return enabledLevels.has(callee.property.name as LogLevel)
}

function getArgsSource(node: AstNode, code: string): string {
  const args = node.arguments
  if (!args || args.length === 0)
    return ''

  const first = args[0]
  const last = args[args.length - 1]
  if (!first || !last || first.start === undefined || last.end === undefined)
    return ''

  return code.slice(first.start, last.end)
}

function buildReplacement(node: AstNode, code: string, index: number): Replacement | null {
  if (node.start === undefined || node.end === undefined || !node.callee || !node.callee.property?.name)
    return null

  const level = node.callee.property.name as LogLevel
  const argsSource = getArgsSource(node, code)
  const argsLiteral = argsSource.trim().length > 0 ? `[${argsSource}]` : '[]'

  const argsVar = `__unplugin_console_args_${index}`
  const resultVar = `__unplugin_console_result_${index}`
  const reportVar = `__unplugin_console_report_${index}`

  return {
    start: node.start,
    end: node.end,
    code: `(function(){const ${argsVar}=${argsLiteral};const ${resultVar}=console.${level}.apply(console,${argsVar});const ${reportVar}=globalThis.__UNPLUGIN_CONSOLE_REPORT__;if(typeof ${reportVar}==='function'){${reportVar}('${level}',${argsVar});}return ${resultVar};})()`,
  }
}

function walkAst(node: unknown, visit: (node: AstNode) => boolean | void): void {
  if (!node)
    return

  if (Array.isArray(node)) {
    for (const child of node) {
      walkAst(child, visit)
    }
    return
  }

  if (typeof node !== 'object')
    return

  const astNode = node as AstNode
  const skipChildren = visit(astNode) === true
  if (skipChildren)
    return

  for (const key in astNode) {
    if (key === 'range' || key === 'start' || key === 'end' || key === 'loc')
      continue
    walkAst(astNode[key], visit)
  }
}

export function instrumentConsoleCalls(
  code: string,
  id: string,
  levels: LogLevel[],
): string | null {
  const replacements = collectConsoleCallReplacements(code, id, levels)
  if (replacements.length === 0)
    return null

  return applyReplacements(code, replacements)
}

function applyReplacements(code: string, replacements: Replacement[]): string {
  let output = code
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start) + replacement.code + output.slice(replacement.end)
  }
  return output
}

export function collectConsoleCallReplacements(
  code: string,
  id: string,
  levels: LogLevel[],
): Replacement[] {
  if (!code.includes('console.'))
    return []

  let parsed: ReturnType<typeof oxc.parseSync>
  try {
    parsed = oxc.parseSync(cleanId(id), code)
  }
  catch {
    return []
  }

  if (!parsed.program)
    return []
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0)
    return []

  const enabledLevels = new Set(levels)
  const replacements: Replacement[] = []
  let matchIndex = 0

  walkAst(parsed.program as unknown, (node) => {
    if (!isEnabledConsoleCall(node, enabledLevels))
      return false

    const replacement = buildReplacement(node, code, matchIndex)
    if (!replacement)
      return false

    replacements.push(replacement)
    matchIndex += 1

    // If we already replaced this call expression, skip nested children to avoid overlap.
    return true
  })

  replacements.sort((a, b) => b.start - a.start)
  return replacements
}
