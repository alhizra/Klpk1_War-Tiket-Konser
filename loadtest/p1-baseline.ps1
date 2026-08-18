# P1 baseline — War Tiket Konser (Windows PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File loadtest/p1-baseline.ps1

$ErrorActionPreference = "Stop"
$BASE = if ($env:BASE) { $env:BASE } else { "http://localhost:8080" }
$bodyFile = Join-Path $PSScriptRoot "order-body.json"
$jsonBody = (Get-Content -Raw $bodyFile).Trim()

Write-Host "=== BASE = $BASE ===" -ForegroundColor Cyan

Write-Host "`n[1] Health" -ForegroundColor Yellow
curl.exe -s "$BASE/health"
Write-Host ""

Write-Host "`n[2] GET /events/1 (sebelum beban)" -ForegroundColor Yellow
curl.exe -s "$BASE/events/1"
Write-Host ""

Write-Host "`n[3] Baseline baca: autocannon -c 50 -d 15 GET /events/1" -ForegroundColor Yellow
npx --yes autocannon -c 50 -d 15 "$BASE/events/1"

Write-Host "`n[4] Reset kuota sebelum uji panas" -ForegroundColor Yellow
try {
  curl.exe -s -X POST "$BASE/internal/reset-quota/1" -H "x-reset-token: dev-reset"
  Write-Host ""
  docker compose exec -T api node src/seed.js --full 2>$null
} catch {
  Write-Host "Skip compose seed..." -ForegroundColor DarkYellow
}

Write-Host "`n[5] Baseline panas: 5000 POST /orders" -ForegroundColor Yellow
npx --yes autocannon -c 200 -a 5000 `
  -m POST `
  -H "Content-Type: application/json" `
  -b $jsonBody `
  "$BASE/orders"

Write-Host "`n[6] Cek konsistensi kursi (wajib terjual<=500, sisa>=0)" -ForegroundColor Yellow
curl.exe -s "$BASE/events/1"
Write-Host ""

Write-Host "`n[7] Titik jenuh concurrency 10 / 100 / 500 (d=10)" -ForegroundColor Yellow
foreach ($C in @(10, 100, 500)) {
  Write-Host "`n=== concurrency $C ===" -ForegroundColor Cyan
  curl.exe -s -X POST "$BASE/internal/reset-quota/1" -H "x-reset-token: dev-reset" | Out-Null
  npx --yes autocannon -c $C -d 10 `
    -m POST `
    -H "Content-Type: application/json" `
    -b $jsonBody `
    "$BASE/orders"
}

Write-Host "`nSelesai. Salin angka ke docs/BASELINE.md" -ForegroundColor Green
