#!/bin/bash
# Test script for itty-adapter
# Builds and tests all runtimes: Deno, Node.js, Bun, Cloudflare Workers

set -euo pipefail

echo "========================================"
echo "itty-adapter Test Runner"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
TEST_PORT="${TEST_PORT:-8765}"
BASE_URL="http://localhost:$TEST_PORT"
REPORT_FILE="/tmp/itty-adapter-test-report.txt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="${EXAMPLES_DIR:-$SCRIPT_DIR/../../examples}"
LOG_DIR="/tmp/itty-adapter-logs"
MAX_WAIT_SECS=10

# Track test counts directly (avoids fragile grep counting)
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ---------- helpers ----------

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    local patterns=(
        "main_deno"
        "main_node"
        "main_bun"
        "deno.*main_deno"
        "node.*main_node"
        "bun.*main_bun"
        "wrangler.*main_cloudflare-workers"
    )
    for pat in "${patterns[@]}"; do
        pkill -f "$pat" 2>/dev/null || true
    done
    sleep 1
}

trap cleanup EXIT

wait_for_port() {
    local port=$1
    local max=$2
    local elapsed=0
    while ! curl -s --fail "http://localhost:$port" > /dev/null 2>&1; do
        sleep 0.5
        elapsed=$(echo "$elapsed + 0.5" | bc)
        if (( $(echo "$elapsed >= $max" | bc -l) )); then
            return 1
        fi
    done
    return 0
}

kill_server() {
    local pid=$1
    shift
    kill "$pid" 2>/dev/null || true
    for pat in "$@"; do
        pkill -f "$pat" 2>/dev/null || true
    done
    sleep 1
}

# Generic function to start a server, hit it, and verify the response.
#   test_runtime <label> <step> <env_name> <start_command...> -- <kill_patterns...>
#
# Example:
#   test_runtime "Deno" 2 "deno_test_value" \
#       deno run -A --no-check main_deno.ts \
#       -- "deno.*main_deno"
test_runtime() {
    local label=$1; shift
    local step=$1; shift
    local test_name=$1; shift

    # Split args on "--" into cmd_args and kill_patterns
    local cmd_args=()
    local kill_patterns=()
    local saw_separator=false
    for arg in "$@"; do
        if [[ "$arg" == "--" ]]; then
            saw_separator=true
            continue
        fi
        if $saw_separator; then
            kill_patterns+=("$arg")
        else
            cmd_args+=("$arg")
        fi
    done

    echo -e "\n${YELLOW}[$step/$TOTAL_TESTS] Testing ${label} server...${NC}"
    echo "--- ${label} Server Test ---" >> "$REPORT_FILE"

    local log_file="$LOG_DIR/${label,,}.log"

    # Start server
    (cd "$EXAMPLES_DIR" && PORT=$TEST_PORT NAME="$test_name" "${cmd_args[@]}" > "$log_file" 2>&1) &
    local srv_pid=$!

    # Wait for the port
    if wait_for_port "$TEST_PORT" "$MAX_WAIT_SECS"; then
        local response
        response=$(curl -s "$BASE_URL")
        if echo "$response" | grep -q "hello $test_name"; then
            echo -e "${GREEN}✓ ${label}: PASS${NC} (response: $response)"
            echo "${label}: PASS (got: $response)" >> "$REPORT_FILE"
            (( PASS_COUNT++ )) || true
        else
            echo -e "${RED}✗ ${label}: FAIL${NC} (expected 'hello $test_name', got: $response)"
            echo "${label}: FAIL (got: $response)" >> "$REPORT_FILE"
            (( FAIL_COUNT++ )) || true
        fi
    else
        echo -e "${RED}✗ ${label}: FAIL${NC} (server not responding after ${MAX_WAIT_SECS}s)"
        echo "${label}: FAIL (server not responding)" >> "$REPORT_FILE"
        echo -e "${BLUE}  ↳ log tail:${NC}"
        tail -20 "$log_file" 2>/dev/null | sed 's/^/    /'
        (( FAIL_COUNT++ )) || true
    fi

    kill_server "$srv_pid" "${kill_patterns[@]}"
}

# Skip helper
skip_runtime() {
    local label=$1
    local step=$2
    local reason=$3
    echo -e "\n${YELLOW}[$step/$TOTAL_TESTS] Testing ${label} server...${NC}"
    echo -e "${YELLOW}○ ${label}: SKIP${NC} ($reason)"
    echo "${label}: SKIP ($reason)" >> "$REPORT_FILE"
    (( SKIP_COUNT++ )) || true
}

# ---------- main ----------

cleanup 2>/dev/null

mkdir -p "$LOG_DIR"

# Initialize report
{
    echo "itty-adapter Test Report"
    echo "========================"
    echo "Date: $(date)"
    echo ""
} > "$REPORT_FILE"

TOTAL_TESTS=5

# 1. Build
echo -e "\n${YELLOW}[1/$TOTAL_TESTS] Building examples...${NC}"
cd "$EXAMPLES_DIR"
if deno task build > "$LOG_DIR/build.log" 2>&1; then
    echo -e "${GREEN}✓ Build complete${NC}"
    echo "Build: PASS" >> "$REPORT_FILE"
    (( PASS_COUNT++ )) || true
else
    echo -e "${RED}✗ Build failed${NC}"
    echo -e "${BLUE}  ↳ log tail:${NC}"
    tail -20 "$LOG_DIR/build.log" | sed 's/^/    /'
    echo "Build: FAIL" >> "$REPORT_FILE"
    (( FAIL_COUNT++ )) || true
    echo -e "\n${RED}Build failed — aborting remaining tests.${NC}"
    exit 1
fi

# 2. Deno
test_runtime "Deno" 2 "deno_test_value" \
    deno run -A --no-check main_deno.ts \
    -- "deno.*main_deno"

# 3. Node.js
if command -v node &>/dev/null; then
    test_runtime "Node.js" 3 "node_test_value" \
        node dist/main_node.mjs \
        -- "node.*main_node"
else
    skip_runtime "Node.js" 3 "not installed"
fi

# 4. Bun
if command -v bun &>/dev/null; then
    bun_cmd="bun"
else
    bun_cmd="npx bun"
fi

if $bun_cmd --version &>/dev/null; then
    echo -e "${BLUE}  Using bun: $($bun_cmd --version)${NC}"
    test_runtime "Bun" 4 "bun_test_value" \
        $bun_cmd dist/main_bun.mjs \
        -- "bun.*main_bun"
else
    skip_runtime "Bun" 4 "not installed"
fi

# 5. Cloudflare Workers (wrangler)
if command -v wrangler &>/dev/null; then
    wrangler_cmd="wrangler"
else
    wrangler_cmd="npx wrangler"
fi

if $wrangler_cmd --version &>/dev/null; then
    echo -e "${BLUE}  Using wrangler: $($wrangler_cmd --version 2>&1 | head -1)${NC}"

    # wrangler reads secrets from .dev.vars
    echo "NAME=worker_test_value" > "$EXAMPLES_DIR/.dev.vars"

    # wrangler needs a slightly different invocation, so we test inline
    echo -e "\n${YELLOW}[5/$TOTAL_TESTS] Testing Worker server...${NC}"
    echo "--- Worker Server Test ---" >> "$REPORT_FILE"

    (cd "$EXAMPLES_DIR" && $wrangler_cmd dev ./dist/main_cloudflare-workers.mjs \
        --port "$TEST_PORT" > "$LOG_DIR/worker.log" 2>&1) &
    WORKER_PID=$!

    if wait_for_port "$TEST_PORT" "$MAX_WAIT_SECS"; then
        WORKER_RESPONSE=$(curl -s "$BASE_URL")
        if echo "$WORKER_RESPONSE" | grep -q "hello worker_test_value"; then
            echo -e "${GREEN}✓ Worker: PASS${NC} (response: $WORKER_RESPONSE)"
            echo "Worker: PASS (got: $WORKER_RESPONSE)" >> "$REPORT_FILE"
            (( PASS_COUNT++ )) || true
        else
            echo -e "${RED}✗ Worker: FAIL${NC} (got: $WORKER_RESPONSE)"
            echo "Worker: FAIL (got: $WORKER_RESPONSE)" >> "$REPORT_FILE"
            (( FAIL_COUNT++ )) || true
        fi
    else
        echo -e "${RED}✗ Worker: FAIL${NC} (server not responding after ${MAX_WAIT_SECS}s)"
        echo "Worker: FAIL (server not responding)" >> "$REPORT_FILE"
        echo -e "${BLUE}  ↳ log tail:${NC}"
        tail -20 "$LOG_DIR/worker.log" 2>/dev/null | sed 's/^/    /'
        (( FAIL_COUNT++ )) || true
    fi

    kill_server "$WORKER_PID" "wrangler.*main_cloudflare-workers"
    rm -f "$EXAMPLES_DIR/.dev.vars"
else
    skip_runtime "Worker" 5 "wrangler not installed"
fi

# ---------- report ----------

echo -e "\n========================================"
echo "Test Report"
echo "========================================"
cat "$REPORT_FILE"
echo "========================================"

echo ""
echo -e "Summary: ${GREEN}${PASS_COUNT} passed${NC}, ${RED}${FAIL_COUNT} failed${NC}, ${YELLOW}${SKIP_COUNT} skipped${NC}"

if (( FAIL_COUNT > 0 )); then
    echo -e "${RED}Some tests failed!${NC}"
    echo -e "Logs are in ${BLUE}${LOG_DIR}/${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi