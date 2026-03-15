import { createServerAdapter } from '@whatwg-node/server'
import { createServer } from 'node:http'
import { app } from './src/app.ts'

// @ts-ignore - process is available in Node.js
const port = parseInt((globalThis as any).process?.env?.PORT || '8000')

const ittyServer = createServerAdapter(app.fetch)
const httpServer = createServer(ittyServer)
console.log(`Listening on http://localhost:${port}/`)
httpServer.listen(port)
