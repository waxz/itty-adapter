import { app } from "./src/app.ts"

const port = parseInt(Deno.env.get('PORT') || '8000')
Deno.serve({ port }, app.fetch)
