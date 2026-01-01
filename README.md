# itty-adapter
Make itty-router work with Hono Adapter.
Get ENV in Bun, Deno, Node, Cloudflare Workers



```ts
import type { IRequest } from "itty-router/"
import { Router } from "itty-router/Router"
import { env, getRuntimeKey } from "../../src/adapter.ts"
import { Context } from "../../src/context.ts"

const app = Router<IRequest>()

app.get("/", (req:Request,ctx:Context) => {

 const {NAME}  = env<{NAME: string }>(ctx);
 console.log(`get ENV NAME: ${NAME}`)

  return new Response(`hello ${NAME}` ,{
    status : 200
  })


})
export { app }

```

## Run On Local

### deno


#### install deno
```shell
curl -fsSL https://deno.land/install.sh | sh
source ~/.bashrc
```

#### run [examples](examples)

#### build 

```shell
deno task build
```

#### run 

```shell
export NAME=tom
deno task start
```

### node

```shell
node dist/main_node.mjs
```

### bun

```shell
npx bun dist/main_bun.mjs
```

### deploy to cloudflare workers/pages

```shell
deno task build
mkdir -p cf
cp ./dist/main_cloudflare-workers.mjs ./cf/_worker.js
npx wrangler dev ./cf/_worker.js --name itty-test --compatibility-date 2025-10-04 --port 8000


npx wrangler deploy ./cf/_worker.js --name itty-test --compatibility-date 2025-10-04

npx wrangler pages deploy ./cf --project-name itty-test

```


## Reference:
https://github.com/zuisong/gemini-openai-proxy
https://github.com/honojs/hono
