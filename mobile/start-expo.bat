@echo off
cd /d "%~dp0"
echo === WTK Mobile Expo ===
echo Pastikan API hidup: http://localhost:3000/health
echo.
echo IP Wi-Fi saat ini:
ipconfig | findstr /I "IPv4"
echo.
echo Edit config.js jika IP beda dari BASE_URL di sana.
echo.
call npx expo start -c
pause
