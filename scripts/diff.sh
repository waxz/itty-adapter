#!/bin/bash
# Download upstream Hono files, diff against local copies, and review in VS Code
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────────


# ── Colors ──────────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

# ── Setup ───────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$SCRIPT_DIR}"
DOWNLOAD_DIR=$(mktemp -d "/tmp/hono-upstream-XXXXXX")
DIFF_DIR=$(mktemp -d "/tmp/hono-diffs-XXXXXX")

echo PROJECT_ROOT:$PROJECT_ROOT
echo SCRIPT_DIR:$SCRIPT_DIR
# Map: upstream URL → local file path (relative to project root)


# 1. Initialize an associative array
declare -A FILE_MAP

# 2. Base URL for the mapping
BASE_URL="https://raw.githubusercontent.com/honojs/hono/main"

# 3. Walk the folder recursively
# globstar (**) allows searching any depth
shopt -s globstar

# We loop through files relative to PROJECT_ROOT
for file in "$PROJECT_ROOT"/src/**/*.ts; do
    if [[ -f "$file" ]]; then
            # Create a relative path (e.g., src/subdir/file.ts) for the URL
        relative_path="${file#$PROJECT_ROOT/}"
        
        # Mapping: [URL] = Absolute Local Path
        FILE_MAP["$BASE_URL/$relative_path"]="$file"

        # Store: [URL]=PATH
        # FILE_MAP["$BASE_URL/$file"]="$file"
    fi
done

# 4. For loop to iterate through the mapping
echo "Iterating through the mapping:"
for url in "${!FILE_MAP[@]}"; do
    path="${FILE_MAP[$url]}"
    
    echo "URL:  $url"
    echo "Path: $path"
    echo "-------------------"
done



trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

echo "========================================"
echo " Hono Upstream Diff Review"
echo "========================================"
echo -e "${DIM}Project root: ${PROJECT_ROOT}${NC}"
echo -e "${DIM}Downloads:    ${DOWNLOAD_DIR}${NC}"
echo -e "${DIM}Diffs:        ${DIFF_DIR}${NC}"
echo ""

# ── Preflight ───────────────────────────────────────────────────────────────────

if ! command -v code &>/dev/null; then
    echo -e "${RED}Error: 'code' (VS Code CLI) not found in PATH.${NC}"
    echo "Install the 'code' command: VS Code → Cmd+Shift+P → 'Shell Command: Install'"
    exit 1
fi

if ! command -v curl &>/dev/null; then
    echo -e "${RED}Error: 'curl' not found.${NC}"
    exit 1
fi

# ── Download & Diff ─────────────────────────────────────────────────────────────

file_count=${#FILE_MAP[@]}
current=0
changed_files=()
missing_local=()
download_failures=()
identical_files=()

for url in "${!FILE_MAP[@]}"; do
    local_rel="${FILE_MAP[$url]}"
    local_abs="${local_rel}"
    filename=$(basename "$local_rel")
    parent_dir=$(dirname "$local_rel" | tr '/' '_')
    safe_name="${parent_dir}__${filename}"

    upstream_file="${DOWNLOAD_DIR}/${safe_name}"

    (( current++ )) || true
    echo -e "${BLUE}[${current}/${file_count}]${NC} ${local_rel}"

    # Download
    if ! curl -sS --fail -L -o "$upstream_file" "$url"; then
        echo -e "  ${RED}✗ Download failed${NC}"
        download_failures+=("$local_rel")
        continue
    fi
    echo -e "  ${GREEN}✓ Downloaded${NC} ${DIM}($(wc -c < "$upstream_file" | tr -d ' ') bytes)${NC}"

    # Check local file exists
    if [[ ! -f "$local_abs" ]]; then
        echo -e "  ${YELLOW}⚠ Local file not found${NC}: ${local_abs}"
        missing_local+=("$local_rel")
        # Still save upstream copy so user can review it
        cp "$upstream_file" "${DIFF_DIR}/${safe_name}.upstream.ts"
        continue
    fi
    echo -e "  ${GREEN}⚠ Local file Found${NC}: ${local_abs}"

    # Diff
    if diff -q "$local_abs" "$upstream_file" &>/dev/null; then
        echo -e "  ${GREEN}● Identical${NC} — no changes"
        identical_files+=("$local_rel")
    else
        echo -e "  ${RED}● Not Identical${NC} — no changes"

        # Count changed lines
        # additions=$(diff --new-line-format='+' --old-line-format='-' --unchanged-line-format='' \
        #     "$local_abs" "$upstream_file" 2>/dev/null | wc -c | tr -d ' ')
        additions=$(diff -u "$local_abs" "$upstream_file" 2>/dev/null \
    | grep -c '^[+-][^+-]') || true
        echo -e "  ${YELLOW}▲ Differences found${NC} (~${additions} chars changed)"

        # Save a unified diff for reference
        # local -> upstream
        diff -u --label "local/${local_rel}" --label "upstream/${local_rel}" \
            "$local_abs" "$upstream_file" \
            > "${DIFF_DIR}/${safe_name}.patch" || true


    
        changed_files+=("$url|$local_abs|$upstream_file|$local_rel")

    fi
done

# ── Summary ─────────────────────────────────────────────────────────────────────

echo ""
echo "========================================"
echo " Summary"
echo "========================================"
echo -e "  ${GREEN}Identical:${NC}        ${#identical_files[@]}"
echo -e "  ${YELLOW}Changed:${NC}          ${#changed_files[@]}"
echo -e "  ${YELLOW}Missing locally:${NC}  ${#missing_local[@]}"
echo -e "  ${RED}Download failed:${NC}  ${#download_failures[@]}"
echo ""

if (( ${#missing_local[@]} > 0 )); then
    echo -e "${YELLOW}Missing local files:${NC}"
    for f in "${missing_local[@]}"; do
        echo "  • $f"
    done
    echo ""
fi

if (( ${#download_failures[@]} > 0 )); then
    echo -e "${RED}Failed downloads:${NC}"
    for f in "${download_failures[@]}"; do
        echo "  • $f"
    done
    echo ""
fi

# ── Open diffs in VS Code ──────────────────────────────────────────────────────

if (( ${#changed_files[@]} == 0 )); then
    echo -e "${GREEN}All files are up to date — nothing to review.${NC}"
    exit 0
fi

echo -e "${BLUE}Opening ${#changed_files[@]} diff(s) in VS Code...${NC}"
echo -e "${DIM}Tip: Close each diff tab when done reviewing.${NC}"
echo ""

for entry in "${changed_files[@]}"; do
    IFS='|' read -r url local_abs upstream_file local_rel <<< "$entry"
    echo -e "  ${YELLOW}↔${NC}  ${local_rel}"
    code --diff  "$upstream_file" "$local_abs" --wait &
done

echo ""

# Interactive: wait for user or let them go
read -rp "Press Enter to finish (background VS Code diffs will stay open)... "

echo ""
echo -e "${GREEN}Done.${NC} Patch files saved in: ${DIFF_DIR}"
echo -e "To apply an upstream file:  ${DIM}cp <upstream_file> <local_path>${NC}"