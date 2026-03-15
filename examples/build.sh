deno task build
cp ./dist/main_cloudflare_workers.mjs ./public/_worker.js
echo "NAME=cf" > .dev.vars
echo "PUBLIC_DIR=./public" >> .dev.vars
