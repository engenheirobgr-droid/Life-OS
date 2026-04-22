@echo off
cd /d "D:\Antigravity\Life OS"
echo Removendo locks do git...
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
echo.
echo Commitando mudancas (v33)...
git add index.html sw.js app.js push_to_github.bat
git diff --cached --quiet
if %ERRORLEVEL% neq 0 (
    git commit -m "v33: fix HTML comment backslash, bump SW cache to v33"
) else (
    echo Sem mudancas para commitar.
)
echo.
echo Fetch + merge + push...
git fetch origin
git merge origin/main -X ours -m "Merge keeping local v33 fixes" 2>nul
git push origin main
echo.
echo === Concluido! ===
pause
