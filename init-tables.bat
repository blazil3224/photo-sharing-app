@echo off
echo Initializing DynamoDB tables...

REM Set environment variable for local development
set ENVIRONMENT=local

REM Run the table initialization script
python backend/scripts/init_tables.py

if %ERRORLEVEL% EQU 0 (
    echo Tables initialized successfully!
) else (
    echo Failed to initialize tables!
    exit /b 1
)

pause