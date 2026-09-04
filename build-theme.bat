@echo off
title Building Stellar Panel Frontend
echo ========================================================
echo   Compiling Frontend React/TypeScript Assets
echo ========================================================
yarn build:production
echo ========================================================
echo   Build complete! Assets generated in public/assets/
echo ========================================================
pause