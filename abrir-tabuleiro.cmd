@echo off
rem Sobe o servidor (se ainda nao estiver rodando) e abre o globo no navegador
cd /d "%~dp0"
netstat -ano | findstr "127.0.0.1:8080" | findstr LISTENING >nul || start "Tabuleiro" /min node scripts\servidor.js
timeout /t 1 >nul
start "" http://localhost:8080
