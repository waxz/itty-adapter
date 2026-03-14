
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

Deploy to Cloudflare Workers

```bash
# Bundle for Workers
mkdir -p dist/
deno bundle  src/main_cloudflare-workers.ts -o dist/_worker.js


# Deploy
npx wrangler deploy
```
