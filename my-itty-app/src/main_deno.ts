import { app } from "./app.ts"

const port = parseInt(Deno.env.get('PORT') || '8000')
console.log(`Listening on http://localhost:${port}/`)
Deno.serve({ port }, app.fetch)
