import type { IRequest } from "itty-router/"
import { cors } from "itty-router/cors"
import { Router } from "itty-router/Router"
import { error } from "itty-router"

import { Context } from "itty-adapter/context.ts"
import { env as getContextEnv, getRuntimeKey } from "itty-adapter/adapter.ts"
import { getEnv } from "itty-adapter/env.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Environment {

}
type ENV_NAMESPACE = {
    NAME?: string;
    CUSTOM_VAR?:string;
    PUBLIC_DIR?:string;
    params?: {
        [key: string]: string;
    };
    query?: {
        [key: string]: string | string[] | undefined;
    };
    proxy?: any;
}


// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
} as const

const { preflight } = cors({ allowHeaders: "*" })

/**
 * Corsify a response, handling immutable headers safely.
 * Skips responses that already carry CORS headers or WebSocket upgrades.
 */
const corsify = (response: Response, request?: Request): Response => {
  if (
    response.headers.get("access-control-allow-origin") ||
    response.status === 101
  ) {
    return response
  }

  const origin = request?.headers.get("origin") || "*"
  const headers = new Headers(response.headers)

  headers.set("access-control-allow-origin", origin)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = Router<IRequest>({
  before: [preflight],
  finally: [corsify],
})

// ---- Routes ---------------------------------------------------------------

/** Health / greeting endpoint */
app.get("/", (_req: Request  ,ctx) => {

  console.log("ctx:", ctx);

  console.log(`check params : req:${_req}, ctx:${ctx}`)
  let name = "";
  {
    const { NAME } = getContextEnv<ENV_NAMESPACE>(ctx);
    console.log(`check ctx NAME:${NAME}`)
  if (NAME){
    name = NAME;
    }
  }
 
      
  return new Response(`hello ${name}`, { status: 200 })

})

/** Serve static assets via unified ASSETS fetcher */
app.get("/asset/*", async (req: Request, ctx: Context) => {
  try {
  const {NAME,PUBLIC_DIR} = getContextEnv<ENV_NAMESPACE>(ctx);
  const asset_dir = PUBLIC_DIR || "./public";

  console.log("NAME:",NAME)
  console.log("PUBLIC_DIR:",PUBLIC_DIR)
  console.log("asset_dir:",asset_dir)

    const unifiedEnv = getEnv(ctx,asset_dir);

    const response = await unifiedEnv.ASSETS.fetch(req)

    if (!response.ok) {
      return error(response.status, `Asset not found: ${new URL(req.url).pathname}`)
    }

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return error(502, `Failed to fetch asset: ${message}`)
  }
})

/** Example: read a custom env var */
app.get("/custom", (_req: Request, ctx: Context) => {
  const { CUSTOM_VAR } = getContextEnv<ENV_NAMESPACE>(ctx)

  if (!CUSTOM_VAR) {
    return error(404, "CUSTOM_VAR is not configured")
  }

  return new Response(CUSTOM_VAR, { status: 200 })
})

/** Catch-all – 404 for anything unmatched */
app.all("*", () => error(404, "Route not found"))

export { app }