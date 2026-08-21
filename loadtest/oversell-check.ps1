# Uji cepat anti-oversell (tanpa autocannon/k6).
# Syarat: API hidup di BASE, Redis+Postgres OK.
# Usage: powershell -File loadtest/oversell-check.ps1
#        $env:BASE="http://127.0.0.1:3000"; $env:EVENT_ID="11"; $env:SHOTS="80"

$ErrorActionPreference = "Continue"
$BASE = if ($env:BASE) { $env:BASE } else { "http://127.0.0.1:3000" }
$EVENT_ID = if ($env:EVENT_ID) { [int]$env:EVENT_ID } else { 11 }
$SHOTS = if ($env:SHOTS) { [int]$env:SHOTS } else { 80 }
$TOKEN = if ($env:RESET_TOKEN) { $env:RESET_TOKEN } else { "dev-reset" }

Write-Host "BASE=$BASE EVENT_ID=$EVENT_ID SHOTS=$SHOTS"

$health = curl.exe -s -m 5 "$BASE/health"
Write-Host "health: $health"
if (-not $health) { Write-Error "API tidak merespons"; exit 1 }

# Reset kuota penuh
$reset = curl.exe -s -m 10 -X POST "$BASE/internal/reset-quota/$EVENT_ID" -H "x-reset-token: $TOKEN"
Write-Host "reset: $reset"

$before = curl.exe -s -m 10 "$BASE/events/$EVENT_ID"
# Ambil quotaTotal & sisa dari JSON sederhana
$quota = 0
if ($before -match '"quotaTotal"\s*:\s*(\d+)') { $quota = [int]$Matches[1] }
$sisaBefore = 0
if ($before -match '"sisa"\s*:\s*(\d+)') { $sisaBefore = [int]$Matches[1] }
Write-Host "before quotaTotal=$quota sisa=$sisaBefore"

# Tembak berurutan (ceiling jujur; race berat = k6/autocannon)
# Body lewat file agar aman di PowerShell (hindari escape JSON)
$ok = 0; $rej409 = 0; $rej429 = 0; $other = 0; $err5 = 0
$bodyFile = Join-Path $env:TEMP ("wtk-order-" + [guid]::NewGuid().ToString() + ".json")
Set-Content -Path $bodyFile -Value (@{ eventId = $EVENT_ID; qty = 1 } | ConvertTo-Json -Compress) -Encoding ascii -NoNewline
$sw = [System.Diagnostics.Stopwatch]::StartNew()
for ($i = 1; $i -le $SHOTS; $i++) {
  $code = curl.exe -s -o NUL -w "%{http_code}" -m 15 -X POST "$BASE/orders" `
    -H "Content-Type: application/json" --data-binary "@$bodyFile"
  switch ($code) {
    "201" { $ok++ }
    "409" { $rej409++ }
    "429" { $rej429++ }
    default {
      if ($code -match '^5') { $err5++ } else { $other++ }
    }
  }
}
$sw.Stop()
Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue

$after = curl.exe -s -m 10 "$BASE/events/$EVENT_ID"
$sisaAfter = 0; $terjual = 0
if ($after -match '"sisa"\s*:\s*(\d+)') { $sisaAfter = [int]$Matches[1] }
if ($after -match '"terjual"\s*:\s*(\d+)') { $terjual = [int]$Matches[1] }

Write-Host ""
Write-Host "=== HASIL oversell-check ==="
Write-Host "duration_ms=$($sw.ElapsedMilliseconds) shots=$SHOTS"
Write-Host "201=$ok 409=$rej409 429=$rej429 5xx=$err5 other=$other"
Write-Host "after terjual=$terjual sisa=$sisaAfter quotaTotal=$quota"
$sum = $terjual + $sisaAfter
$oversell = $false
if ($terjual -gt $quota) { $oversell = $true }
if ($quota -gt 0 -and $sum -ne $quota) { Write-Host "WARN sum terjual+sisa=$sum != quota $quota (cek sold db vs redis)" }

if ($oversell) {
  Write-Host "OVERSELL=YES gagal"
  exit 2
}
if ($err5 -gt 0) {
  Write-Host "OVERSELL=NO tetapi ada 5xx=$err5"
  exit 3
}
Write-Host "OVERSELL=NO ok (201 tidak melebihi kuota runtime)"
if ($ok -gt $quota) {
  Write-Host "FAIL: 201 count $ok > quota $quota"
  exit 2
}
exit 0
