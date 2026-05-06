@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo ====================================
echo  GitHubへアップロード中...
echo ====================================
echo.

git add -A

set /p msg="更新メモ（空白のままでもOK）: "
if "%msg%"=="" set msg=フレーム更新

git commit -m "%msg%"
git push

echo.
echo ====================================
echo  完了しました！
echo  1〜2分後にサイトに反映されます。
echo ====================================
echo.
pause
