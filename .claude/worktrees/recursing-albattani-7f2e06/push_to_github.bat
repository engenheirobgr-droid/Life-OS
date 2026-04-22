@echo off
cd /d "D:\Antigravity\Life OS"
echo Removendo lock do git...
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
echo.
echo Commit ja criado. Fazendo push...
git push origin main
echo.
echo === Concluido! ===
pause
