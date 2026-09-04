@echo off
title The New Stellar Panel - Dev Server
echo ========================================================
echo         The New Stellar Panel (Pterodactyl Base)
echo ========================================================
echo.

set "PHP_PATH=C:\Users\aghil\.stellar_tools\php83"
set "MARIA_PATH=C:\Users\aghil\.stellar_tools\mariadb"
set "PATH=%PHP_PATH%;%MARIA_PATH%\bin;C:\Users\aghil\.stellar_tools\composer;%PATH%"

netstat -ano | findstr /R /C:":3306 " >nul
if %errorlevel% neq 0 (
    echo [1/4] Starting local MariaDB server on port 3306...
    start "MariaDB Server" /min "%MARIA_PATH%\bin\mariadbd.exe" --defaults-file="%MARIA_PATH%\my.ini" --console
    timeout /t 2 /nobreak >nul
) else (
    echo [1/4] MariaDB server is already running.
)

netstat -ano | findstr /R /C:":8088 " >nul
if %errorlevel% neq 0 (
    echo [2/4] Starting Mock Wings Daemon on port 8088...
    start "Mock Wings Daemon" /min node "C:\Users\aghil\.stellar_tools\mock_wings.js"
    timeout /t 1 /nobreak >nul
) else (
    echo [2/4] Mock Wings Daemon is already running on port 8088.
)

echo [3/4] Opening browser at http://localhost:8000 ...
start http://localhost:8000

echo [4/4] Starting Laravel Development Server on http://localhost:8000 ...
echo.
echo Admin Credentials:
echo   URL:      http://localhost:8000/auth/login
echo   Email:    admin@stellar.local
echo   Password: Password123!
echo.
echo Press Ctrl+C to stop the panel server.
echo ========================================================
"%PHP_PATH%\php.exe" artisan serve --port=8000