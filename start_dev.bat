@echo off
echo ========================================================
echo Launching Multi-Agent Document Intelligence Platform
echo ========================================================

start "Backend - FastAPI & LangGraph" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "Frontend - Angular 21" cmd /k "cd frontend && npm start"

echo.
echo FastAPI Backend launching on: http://localhost:8000/api/v1/docs
echo Angular Frontend launching on: http://localhost:4200
echo.
pause
