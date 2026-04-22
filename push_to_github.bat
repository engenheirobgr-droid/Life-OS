@echo off
cd /d "D:\Antigravity\Life OS"
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
git add app.js index.html views/painel.html views/perfil.html sw.js
git diff --cached --quiet
if %ERRORLEVEL% neq 0 (
    git commit -m "feat: Phase 1-3 Life OS improvements"
)
git fetch origin
git merge origin/main -X ours -m "Merge keeping local debug" 2>nul
git push origin main
echo === Concluido! ===
pause
