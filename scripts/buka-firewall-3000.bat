@echo off
:: Jalankan sebagai Administrator (klik kanan → Run as administrator)
echo Membuka firewall port 3000 (API) dan 3001 (Next)...
netsh advfirewall firewall delete rule name="WTK-API-3000" >nul 2>&1
netsh advfirewall firewall delete rule name="WTK-NEXT-3001" >nul 2>&1
netsh advfirewall firewall add rule name="WTK-API-3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
netsh advfirewall firewall add rule name="WTK-NEXT-3001" dir=in action=allow protocol=TCP localport=3001 profile=private,domain
echo.
echo Selesai. Coba di browser HP/PC:
echo   http://192.168.10.115:3000/api/health
echo.
pause
