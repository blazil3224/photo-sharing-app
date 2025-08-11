@echo off
echo Testing DynamoDB models...

REM Set environment variable for local development
set ENVIRONMENT=local

REM Run the model test script
python backend/scripts/test_models.py

if %ERRORLEVEL% EQU 0 (
    echo Model tests passed successfully!
) else (
    echo Model tests failed!
    exit /b 1
)

pause