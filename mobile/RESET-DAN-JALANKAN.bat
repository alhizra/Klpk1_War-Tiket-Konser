@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ============================================
echo  WTK Mobile — RESET + START (Modul 3)
echo ============================================
echo.
echo  SEBELUM SCAN QR DI HP:
echo   1. Matikan DATA SELULER (LTE) di HP
echo   2. HP sambung Wi-Fi SAMA dengan laptop
echo   3. Browser HP buka:
echo      http://10.87.96.26:3000/api/health
echo      Harus muncul {"ok":true ...}
echo   4. API laptop: node src/server.js (folder root)
echo.
echo  Lalu scan QR yang MUNCUL di terminal ini.
echo ============================================
echo.

if exist .expo rd /s /q .expo 2>nul
echo Membersihkan cache Metro...
call npx expo start --lan -c
