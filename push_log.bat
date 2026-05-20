@echo off
cd /d "D:\Antigravity\Life OS"
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
if exist ".git\refs\heads\main.lock" del /f /q ".git\refs\heads\main.lock"
echo Pushing... > push_result.txt
git push origin main >> push_result.txt 2>&1
echo Exit code: %ERRORLEVEL% >> push_result.txt
type push_result.txt
pause
