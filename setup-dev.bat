@echo off
echo Setting up Photo Sharing App Development Environment...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo Creating LocalStack data directory...
if not exist "localstack" mkdir localstack

echo Building Docker images...
docker-compose build

echo Setup complete! You can now run start-dev.bat to start the development environment.
echo.
echo Services will be available at:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:5000
echo - DynamoDB Local: http://localhost:8000
echo - LocalStack S3: http://localhost:4566
echo.
pause