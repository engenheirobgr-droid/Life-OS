@echo off
cd /d "D:\Antigravity\Life OS"
echo Removendo locks do git...
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
echo.
echo Commitando mudancas locais...
git add app.js sw.js index.html push_to_github.bat
git diff --cached --quiet
if %ERRORLEVEL% neq 0 (
    git commit -m "v32: fix image sync - updateDoc dot-notation paths"
) else (
    echo Sem mudancas para commitar.
)
echo.
echo Buscando remoto...
git fetch origin
echo.
echo Merge do remoto (favorecendo versao local)...
git merge origin/main -X ours -m "Merge remote v31 keeping local image sync fix"
echo.
echo Push...
git push origin main
echo.
echo === Concluido! ===
pause
