mkdir -p dist
rm -r ./dist
deno bundle  src/main_cloudflare-workers.ts -o dist/main_cloudflare-workers.mjs --sourcemap
deno bundle  src/main_bun.ts -o dist/main_bun.mjs --sourcemap
deno bundle  src/main_deno.ts -o dist/main_deno.mjs --sourcemap
deno bundle  src/main_node.ts -o dist/main_node.mjs --sourcemap
