@echo off
cd /d "%~dp0"
echo === Expo TUNNEL (perlu akun expo.dev) ===
echo Login sekali: npx expo login
echo.
call npx expo start -c --tunnel
pause
