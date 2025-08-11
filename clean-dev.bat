@echo off
echo Cleaning Photo Sharing App Development Environment...
echo.

echo Stopping and removing containers...
docker-compose down --volumes --remove-orphans

echo Removing unused images...
docker image prune -f

echo Cleaning complete.
pause