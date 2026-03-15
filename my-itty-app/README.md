
# server using itty-adapter


### Install dependency
```
npm init
npm i itty-router
npm i @hono/node-server
npm i ../itty-adapter-1.0.1.tgz 
```

### Run
```bash
PORT=8000 NAME=World deno run -A src/main.ts 
```

## Install dependency
```
curl -fsSL https://deno.land/install.sh | sh
source ~/.bashrc

deno add npm:@whatwg-node/server

npx bun
npx wrangler

```

## Run test
```bash
# Bundle for Workers
mkdir -p dist/
deno bundle  src/main_cloudflare-workers.ts -o dist/_worker.js

mkdir -p dist
rm -r ./dist
deno bundle  src/main_cloudflare-workers.ts -o dist/main_cloudflare-workers.mjs --sourcemap
deno bundle  src/main_bun.ts -o dist/main_bun.mjs --sourcemap
deno bundle  src/main_deno.ts -o dist/main_deno.mjs --sourcemap
deno bundle  src/main_node.ts -o dist/main_node.mjs --sourcemap


# Deploy
npx wrangler deploy
```
