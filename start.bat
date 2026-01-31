@echo off
echo ==========================================
echo Stock Calendar - Starting Server
echo ==========================================
echo.

cd /d "%~dp0"

REM Check if frontend build exists
if not exist "frontend\dist\index.html" (
    echo [INFO] Frontend build not found. Building...
    cd frontend
    call npm install
    call npm run build
    cd ..
    echo.
)

REM Start backend server
echo [INFO] Starting backend server on port 7002...
cd backend
python main.py

pause
