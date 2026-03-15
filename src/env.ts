import { getRuntimeKey } from "./helper/adapter/index.ts"

export type Runtime = 'node' | 'deno' | 'bun' | 'workerd' | 'fastly' | 'edge-light' | 'other'

export interface AssetsFetcher {
  fetch: (request: Request) => Promise<Response>
}

export type EnvWithAssets<T> = T & { ASSETS: AssetsFetcher }

/** Common MIME types by file extension */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.wasm': 'application/wasm',
  '.xml':  'application/xml',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Infer MIME type from a file path's extension.
 * Falls back to `application/octet-stream` for unknown types.
 */
const getMimeType = (path: string): string => {
  const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? ''
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * Resolve and sanitise the pathname into a safe local file path.
 * Prevents directory-traversal attacks and normalises index files.
 */
const resolveLocalPath = (pathname: string, baseDir = './public'): string => {
  // Decode, collapse sequences, strip traversal segments
  const decoded = decodeURIComponent(pathname)
  const sanitised = decoded
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg !== '..' && seg !== '.' && seg !== '')
    .join('/')

  const fullPath = `${baseDir}/${sanitised}`
  return fullPath.endsWith('/') || sanitised === ''
    ? `${fullPath}${fullPath.endsWith('/') ? '' : '/'}index.html`
    : fullPath
}

/**
 * Read a file from disk for the current runtime.
 * Returns the file contents as a Response, or null if the runtime
 * doesn't support local file reads.
 */
const readFileForRuntime = async (
  path: string,
  runtime: Runtime
): Promise<Response | null> => {
  const mimeType = getMimeType(path)
  const headers = { 'Content-Type': mimeType }

  switch (runtime) {
    case 'bun': {
      // @ts-ignore – Bun global
      const file = Bun.file(path)
      // Bun.file doesn't throw on missing files; check existence
      // @ts-ignore
      if (!(await file.exists())) return null
      return new Response(file, { headers })
    }

    case 'deno': {
      // @ts-ignore – Deno global
      const data = await Deno.readFile(path)
      return new Response(data, { headers })
    }

    case 'node': {
      const { readFile } = await import('node:fs/promises')
      const data = await readFile(path)
      return new Response(data, { headers })
    }

    default:
      return null
  }
}

/**
 * Build an ASSETS polyfill that serves static files from the local
 * filesystem, with proper MIME types and error handling.
 */
const createLocalAssetsFetcher = (
  runtime: Runtime,
  baseDir = './public'
): AssetsFetcher => ({
  fetch: async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const path = resolveLocalPath(url.pathname, baseDir)

    try {
      const response = await readFileForRuntime(path, runtime)
      if (response) return response
    } catch {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new Response('Asset serving is not supported for this runtime', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  },
})

/**
 * Return an env object that is guaranteed to include a unified
 * `ASSETS.fetch()` method.
 *
 * - On **Cloudflare Workers** the native ASSETS binding is used as-is.
 * - On **Node / Deno / Bun** a local-filesystem polyfill is provided.
 *
 * @param env      The original env/bindings object.
 * @param runtime  Override the auto-detected runtime (useful for testing).
 * @param baseDir  Root directory for the local assets polyfill (default `./public`).
 */
const getEnv = <T extends Record<string, unknown>>(
  env: T,
  baseDir = './public'
): EnvWithAssets<T> => {
  const runtime: Runtime = getRuntimeKey();
  

  // Native ASSETS binding – nothing to patch
  if (runtime === 'workerd' && env?.ASSETS) {
    return env as EnvWithAssets<T>
  }

  return {
    ...env,
    ASSETS: createLocalAssetsFetcher(runtime, baseDir),
  }
}

export { getEnv }