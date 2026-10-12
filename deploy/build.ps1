# PHERO-MESH — Windows PowerShell Build Pipeline
$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  PHERO-MESH — Turnaround Mathematical Swarm OS Build Pipeline   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$RootPath = (Get-Item $PSScriptRoot).Parent.FullName

Write-Host "[1/4] Checking Rust and WebAssembly toolchain..." -ForegroundColor Yellow
cd "$RootPath\crates\ramp-math-core"

Write-Host "[2/4] Compiling Rust Mathematical Engine to WebAssembly..." -ForegroundColor Yellow
npx -y wasm-pack build --target web --release --out-dir ..\..\packages\web-app\src\wasm

Write-Host "[3/4] Installing web-app dependencies..." -ForegroundColor Yellow
cd "$RootPath\packages\web-app"
npm install --no-audit

Write-Host "[4/4] Building Vite Production Bundle..." -ForegroundColor Yellow
npm run build

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Validating Bundle Integrity...                                  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if (Test-Path "$RootPath\packages\web-app\dist\index.html") {
    Write-Host "✔ dist/index.html verified." -ForegroundColor Green
} else {
    Write-Error "Missing dist/index.html!"
}

$WasmFiles = Get-ChildItem -Path "$RootPath\packages\web-app\dist" -Filter "*.wasm" -Recurse
if ($WasmFiles.Count -gt 0) {
    Write-Host "✔ WebAssembly binary verified ($($WasmFiles.Count) found in dist)." -ForegroundColor Green
} else {
    Write-Error "No .wasm binary found in distribution!"
}

Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  PHERO-MESH Build Succeeded! Ready for deployment.               " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
