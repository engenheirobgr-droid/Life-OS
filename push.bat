@echo off
echo Cleaning git lock files...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
echo Pushing to GitHub...
git push origin main
echo Done. Press any key to close.
pause
