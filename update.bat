@echo off
cd /d "%~dp0"

echo.
echo Uploading to GitHub...
echo.

git add -A
git commit -m "update frames"
git push

echo.
echo Done!
echo.
pause
