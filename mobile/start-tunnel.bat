@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ============================================
echo  Expo TUNNEL — Modul 3 (BUKAN Next.js)
echo ============================================
echo.
echo  PENTING:
echo  - Project ini sudah Expo/React Native di folder mobile/
echo  - JANGAN buat Next.js — tunnel = npx expo start --tunnel
echo  - Tunnel = HP bisa load JS bundle walau beda Wi-Fi
echo  - API backend tetap harus bisa dijangkau HP:
echo      * Wi-Fi sama: http://10.87.96.26:3000  (config.js)
echo      * Atau API public (Codespace/ngrok) di EXPO_PUBLIC_API_URL
echo.
echo  1) Pastikan API laptop: npm start di root repo
echo  2) Login Expo sekali (jika diminta):
echo       npx expo login
echo  3) Scan QR yang muncul di Expo Go
echo ============================================
echo.

call npx expo start --tunnel -c
pause
