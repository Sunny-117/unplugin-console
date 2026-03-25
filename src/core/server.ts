import type { ConsolePayload } from '../types'
import http from 'node:http'
import { printLog } from './logger'
import { ENDPOINT } from './runtime'

export function createLogServer(port: number, prefix: string): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === ENDPOINT) {
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
      return
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[unplugin-console] Log server listening on http://localhost:${port}${ENDPOINT}`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.warn(`[unplugin-console] Port ${port} is already in use, log server skipped`)
    }
    else {
      // eslint-disable-next-line no-console
      console.error(`[unplugin-console] Log server error:`, err)
    }
  })

  return server
}
