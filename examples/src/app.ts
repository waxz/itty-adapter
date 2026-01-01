import type { IRequest } from "itty-router/"
import { cors } from "itty-router/cors"
import { Router } from "itty-router/Router"
import { type Any, Logger } from "../../src/log.ts"
import { env, getRuntimeKey } from "../../src/adapter.ts"
import { Context } from "../../src/context.ts"


const { preflight } = cors({ allowHeaders: "*" })

// Patched corsify to handle immutable headers
const corsify = (response: Response, request?: Request) => {
  if (response?.headers?.get("access-control-allow-origin") || response.status === 101) {
    return response;
  }
  const origin = request?.headers?.get("origin") || "*";
  const newHeaders = new Headers(response.headers);
  newHeaders.append("access-control-allow-origin", origin);
  newHeaders.append("access-control-allow-methods", "*");
  newHeaders.append("access-control-allow-headers", "*");
  return new Response(response.body, { status: response.status, headers: newHeaders });
}
// Optional: Define a TypeScript interface for your environment variables for type safety
interface Environment {
  NAME: string;
}
const app = Router<IRequest>({
  before: [
    preflight,
    (req) => {
      req.logger = new Logger(crypto.randomUUID().toString())
      req.logger.warn(`--> ${req.method} ${req.url}`)
    },
  ],
  finally: [
    corsify,
    (_, req) => {
      req.logger?.warn(`<-- ${req.method} ${req.url}`)
      // return resp
    },
  ],
})

app.get("/", (req:Request,ctx:Context) => {

 const {NAME}  = env<{NAME: string }>(ctx);
 console.log(`get ENV NAME: ${NAME}`)

  return new Response(`hello ${NAME}` ,{
    status : 200
  })


})
export { app }
