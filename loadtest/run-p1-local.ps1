# Baseline P1 ke API lokal :3000 — body JSON dari file (aman di PowerShell)
$ErrorActionPreference = "Continue"
$BASE = if ($env:BASE) { $env:BASE } else { "http://127.0.0.1:3000" }
$BODY = Join-Path $PSScriptRoot "order-body.json"
$out = New-Object System.Collections.Generic.List[string]

function Log([string]$m) {
  Write-Host $m
  $out.Add($m) | Out-Null
}

function Invoke-Autocannon {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AcArgs)
  $tmp = Join-Path $env:TEMP ("ac-" + [guid]::NewGuid().ToString() + ".txt")
  & npx --yes autocannon @AcArgs *> $tmp
  $text = Get-Content $tmp -Raw -ErrorAction SilentlyContinue
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  return $text
}

Log "BASE=$BASE BODY=$BODY"
Log "=== health ==="
Log (curl.exe -s "$BASE/health")

Log "=== reset kuota full ==="
Log (curl.exe -s -X POST "$BASE/internal/reset-quota/1" -H "x-reset-token: dev-reset")

Log "=== events/1 before ==="
Log (curl.exe -s "$BASE/events/1")

Log "=== READ autocannon -c 50 -d 15 ==="
Log (Invoke-Autocannon -c 50 -d 15 "$BASE/events/1")

Log "=== reset before hot ==="
Log (curl.exe -s -X POST "$BASE/internal/reset-quota/1" -H "x-reset-token: dev-reset")

Log "=== HOT autocannon -c 200 -a 5000 POST /orders (body file) ==="
# Baca JSON dari file lalu pass -b (autocannon tidak punya -i di semua versi)
$jsonBody = (Get-Content -Raw $BODY).Trim()
Log (Invoke-Autocannon -c 200 -a 5000 -m POST -H "Content-Type: application/json" -b $jsonBody "$BASE/orders")

Log "=== events/1 after hot ==="
Log (curl.exe -s "$BASE/events/1")

foreach ($C in @(10, 100, 500)) {
  Log "=== knee c=$C d=10 ==="
  curl.exe -s -X POST "$BASE/internal/reset-quota/1" -H "x-reset-token: dev-reset" | Out-Null
  Log (Invoke-Autocannon -c $C -d 10 -m POST -H "Content-Type: application/json" -b $jsonBody "$BASE/orders")
  Log (curl.exe -s "$BASE/events/1")
}

$path = Join-Path $PSScriptRoot "p1-local-result.txt"
$out -join "`n" | Set-Content -Path $path -Encoding utf8
Log "Saved $path"
