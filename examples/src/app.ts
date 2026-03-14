import type { IRequest } from "itty-router/"
import { cors } from "itty-router/cors"
import { Router } from "itty-router/Router"
import { Context } from "itty-adapter/context.ts"

import { env } from "itty-adapter/adapter.ts"


const { preflight } = cors({ allowHeaders: "*" })

// Patched corsify to handle immutable headers
const corsify = (response: Response, request?: Request) => {
  if (response?.headers?.get("access-control-allow-origin") || response.status === 101) {
    return response
  }
  const origin = request?.headers?.get("origin") || "*"
  const newHeaders = new Headers(response.headers)
  newHeaders.append("access-control-allow-origin", origin)
  newHeaders.append("access-control-allow-methods", "*")
  newHeaders.append("access-control-allow-headers", "*")
  return new Response(response.body, { status: response.status, headers: newHeaders })
}
// Optional: Define a TypeScript interface for your environment variables for type safety
interface Environment {
  NAME: string;
  CUSTOM_VAR?: string;
}
const app = Router<IRequest>({
  before: [
    preflight,
  ],
  finally: [
    corsify,
  ],
})

app.get("/", (req:Request,ctx:Context) => {

 const {NAME}  = env<{NAME: string }>(ctx);
 console.log("Receive Req:", req);

  return new Response(`hello ${NAME}` ,{
    status : 200
  })


})

app.get("/custom", (req:Request,ctx:Context) => {

 const {CUSTOM_VAR}  = env<{CUSTOM_VAR: string }>(ctx);
 console.log("Receive Req:", req);

  return new Response(CUSTOM_VAR ,{
    status : 200
  })


})
export { app }
