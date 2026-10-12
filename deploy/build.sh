#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo "  PHERO-MESH — Turnaround Mathematical Swarm OS Build Pipeline   "
echo "=================================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Checking Rust and WebAssembly toolchain..."
if ! command -v cargo &> /dev/null; then
    echo "ERROR: Cargo is required to compile ramp-math-core." >&2
    exit 1
fi

echo "[2/4] Compiling Rust Mathematical Engine to WebAssembly..."
cd "$ROOT_DIR/crates/ramp-math-core"
if command -v wasm-pack &> /dev/null; then
    wasm-pack build --target web --release --out-dir ../../packages/web-app/src/wasm
else
    npx -y wasm-pack build --target web --release --out-dir ../../packages/web-app/src/wasm
fi

echo "[3/4] Installing web-app frontend dependencies..."
cd "$ROOT_DIR/packages/web-app"
npm install --no-audit

echo "[4/4] Building Vite Production Bundle..."
npm run build

echo "=================================================================="
echo "  Validating Bundle Integrity...                                  "
echo "=================================================================="
if [ -f "$ROOT_DIR/packages/web-app/dist/index.html" ]; then
    echo "✔ index.html verified."
else
    echo "❌ Missing dist/index.html!" >&2
    exit 1
fi

WASM_COUNT=$(find "$ROOT_DIR/packages/web-app/dist" -name "*.wasm" | wc -l)
if [ "$WASM_COUNT" -gt 0 ]; then
    echo "✔ WebAssembly binary verified ($WASM_COUNT found in distribution)."
else
    echo "❌ No .wasm binary found in distribution!" >&2
    exit 1
fi

echo "=================================================================="
echo "  PHERO-MESH Build Succeeded! Ready for deployment.               "
echo "=================================================================="
