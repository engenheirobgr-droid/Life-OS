@echo off
cd /d "D:\Antigravity\Life OS"
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
git push origin main
echo === Concluido! ===
pause
