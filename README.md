# itty-adapter
Make itty-router work with Hono-style adapter pattern.
Get ENV in Bun, Deno, Node.js, Cloudflare Workers/Pages.

## IMPORTANT PATCH

This library ports Hono's adapter utilities to work with itty-router. A critical patch was made to correctly return environment bindings for Cloudflare Workers:

```typescript
// Original Hono (incorrect for itty-adapter):
workerd: () => c.env,

// Patched for itty-adapter:
workerd: () => c as unknown as T,

```


See `src/helper/adapter/index.ts` for the complete implementation.


## Sync with [Hono](https://github.com/honojs/hono)

- run `diff.sh` to download source from hono github, generate diff file, review with vscode
```bash
PROJECT_ROOT=$(pwd) ./scripts/diff.s
```

---

## Quick Start

### Build and pack
```
npm run build

npm pack

npm install git+https://github.com/waxz/itty-adapter.git#main

npx create-itty

```

### Create CLI
- Define `bin` in `package.json`
- Include resource `my-itty-app`
- Add `.npmignore` to ignore files.
```
  "bin": {
    "create-itty": "./bin/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "my-itty-app"
  ],
```

### Run with Deno
```bash
cd examples
export NAME=world
deno task start
# Visit http://localhost:8000 -> "hello world"
```

### Run with Node.js
```bash
deno task build
NAME=world node dist/main_node.mjs
# Visit http://localhost:8000 -> "hello world"
```

### Run with Bun
```bash
deno task build
NAME=world bun dist/main_bun.mjs
# Visit http://localhost:8000 -> "hello world"
```

### Run and Deploy to Cloudflare Workers
```bash
deno task build
mkdir -p cf
cp ./dist/main_cloudflare-workers.mjs ./cf/_worker.js

# Development
npx wrangler dev ./cf/_worker.js --name itty-test --compatibility-date 2025-10-04

# Deploy
npx wrangler deploy ./cf/_worker.js --name itty-test --compatibility-date 2025-10-04

# Pages
npx wrangler pages deploy ./cf --project-name itty-test
```

---

## Release
```
npm run pack

npm install itty-adapter-1.0.1.tgz
```

## Demo: Create Your Own Server

[my-itty-app](./my-itty-app)


---

## API

### `env<T>(context, runtime?)`
Returns environment variables. Runtime is auto-detected if not provided:
- `bun` / `node` / `edge-light`: uses `process.env`
- `deno`: uses `Deno.env.toObject()`
- `workerd` (Cloudflare): uses context.env directly as bindings
- `fastly`: returns empty object

### `getRuntimeKey()`
Returns: `'node' | 'deno' | 'bun' | 'workerd' | 'fastly' | 'edge-light' | 'other'`

### Context class
Hono-compatible context with methods:
- `req`, `env`, `res`, `error`, `var`
- `text()`, `json()`, `html()`, `body()`
- `header()`, `status()`, `redirect()`, `notFound()`

---

## Testing

```bash
npm test              # Run integration tests (Deno test runner)
npm run build         # TypeScript compilation
bash examples/run.sh  # Full server+client tests
```

---

## Project Structure

```
/workspaces/itty-adapter/
├── src/
│   ├── index.ts              # Main exports
│   ├── context.ts           # Hono Context class (ported)
│   ├── helper/adapter/
│   │   └── index.ts         # env() and getRuntimeKey()
│   ├── adapter/
│   │   ├── types.ts         # Type definitions
│   │   └── log.ts          # Logger utilities
│   └── utils/               # HTML, MIME, headers, etc.
├── examples/
│   ├── src/app.ts           # Example itty-router app
│   ├── main_*.ts           # Entry points for each runtime
│   ├── tests/
│   │   ├── integration.test.ts  # Integration tests
│   │   └── run.sh           # Bash test runner
│   └── deno.jsonc           # Deno config
├── dist/                    # Compiled output
├── package.json
├── README.md
└── AGENTS.md              # Development guidance
```

---

## Known Issues

### console.log(req) freezes in Node.js
> Use `@whatwg-node/server` instead of `@hono/node-server`.

> When using `@hono/node-server`, logging the raw Request object with `console.log(req)` will freeze the server.

**Root cause:** `@hono/node-server` wraps the Web Request with custom property getters (using `Object.defineProperty`). When Node.js's console.log inspects the object, it accesses these getters which can cause an infinite loop or deadlock.

**Evidence:**
- `console.log(req)` - freezes ❌
- `console.log("req", req)` - freezes ❌  
- `JSON.stringify(req)` - works but returns `{}` ✅
- `console.log(req.url, req.method)` - works ✅

**Solution:** Always extract primitive values before logging:

```typescript
// ❌ Bad - freezes in Node.js
app.get("/", (req, ctx) => {
  console.log("request:", req)  // Freezes!
})

// ✅ Good - works in all runtimes
app.get("/", (req, ctx) => {
  console.log("url:", req.url)
  console.log("method:", req.method)
})
```

---

## Credits

- [itty-router](https://github.com/kwhitley/itty-router)
- [Hono](https://github.com/honojs/hono)
- [gemini-openai-proxy](https://github.com/zuisong/gemini-openai-proxy)
