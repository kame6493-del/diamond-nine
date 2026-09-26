@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
powershell.exe -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList 'scripts/serve-game.mjs' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden"
start "" "http://127.0.0.1:4173/"
