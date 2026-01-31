@echo off
echo ==========================================
echo Stock Calendar - Development Mode
echo ==========================================
echo.
echo Starting Backend (port 7002) and Frontend (port 5200)
echo.

cd /d "%~dp0"

REM Start backend in new window
start "Backend Server" cmd /k "cd backend && python main.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev"

echo.
echo Servers started!
echo - Backend: http://localhost:7002
echo - Frontend: http://localhost:5200
echo.
pause
