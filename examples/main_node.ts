import { serve } from "@hono/node-server"
import { app } from "./src/app.ts"

// @ts-ignore - process is available in Node.js
const port = parseInt((globalThis as any).process?.env?.PORT || '8000')
console.log(`Listening on http://localhost:${port}/`)
serve({
  fetch: app.fetch,
  port,
})
