@echo off
cd /d "%~dp0"
echo.
echo === WTK Mobile untuk HP (Expo Go) ===
echo 1) API laptop harus hidup: http://10.87.96.26:3000/api/health
echo 2) HP: matikan LTE, sambung Wi-Fi SAMA dengan laptop
echo 3) Scan QR di Expo Go
echo.
echo Membersihkan cache Metro...
call npx expo start --lan -c
