import { app } from "./app.ts"

const port = parseInt((globalThis as any).process?.env?.PORT || '8000')

console.log(`Listening on http://localhost:${port}/`)

// @ts-expect-error supress warning
Bun.serve({
  port: port,
  fetch: app.fetch,
})
