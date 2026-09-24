@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo Dependency install failed.
  pause
  exit /b 1
)

echo Building Windows executable...
call npm run dist
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Check the dist folder.
pause
