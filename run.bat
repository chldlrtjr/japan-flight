@echo off
chcp 65001 > nul
title 항공 프로모션 로컬 웹 서비스

echo ========================================================
echo   ✈️ 일본 항공권 특가 & 친구 캘린더 웹 서비스 실행기
echo ========================================================
echo.

cd /d "%~dp0web"

echo [1/2] 브라우저 자동 실행 대기 중...
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

echo [2/2] Next.js 로컬 웹 서버 시작 중...
echo.
echo * 웹 사이트 주소: http://localhost:3000
echo * 종료하려면 이 창을 닫거나 Ctrl + C 를 누르세요.
echo.

npm run dev

pause
