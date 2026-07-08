@echo off
title XML to XLSX Converter
echo ========================================
echo   XML to XLSX Converter - Запуск
echo ========================================
echo.

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Установите Node.js: https://nodejs.org/
    pause
    exit /b 1
)

:: Проверка наличия зависимостей
if not exist "node_modules" (
    echo [ПРЕДУПРЕЖДЕНИЕ] Зависимости не установлены!
    echo.
    echo Запустите install.bat для установки зависимостей.
    echo.
    pause
    exit /b 1
)

:: Проверка наличия папки uploads
if not exist "uploads" mkdir uploads

:: Запуск приложения
echo Запуск сервера...
echo.
echo Сервер будет доступен по адресу: http://localhost:3002
echo Для остановки сервера нажмите Ctrl+C
echo.
node server.js

:: Если сервер упал, показываем сообщение
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Сервер завершил работу с ошибкой!
    echo.
    pause
)