

```
deno task build
cp asset dist/

NAME=123 node dist/main_node.mjs

NAME=123 npx bun ./dist/main_bun.mjs

NAME=123 deno task start -A

echo "NAME=cf" > .dev.vars
npx wrangler dev ./dist/main_cloudflare_workers.mjs --port 8000 --compatibility-flags nodejs_compat  --assets dist


cp ./dist/main_cloudflare_workers.mjs ./public/_worker.js
npx wrangler dev --config ./wrangler_worker.toml --port 8000

npx wrangler pages dev --port 8000


```


### Worker
- https://developers.cloudflare.com/workers/static-assets/
