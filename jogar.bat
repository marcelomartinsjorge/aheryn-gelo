@echo off
cd /d "%~dp0"
echo Iniciando o servidor, aguarde...
start "Servidor" cmd /k "npx --yes http-server -p 8765 -c-1"
timeout /t 5 /nobreak >nul
start "" http://localhost:8765/index.html
