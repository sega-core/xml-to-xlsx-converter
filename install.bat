@echo off
echo ========================================
echo   XML to XLSX Converter - Установка
echo ========================================
echo.

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo.
    echo Для работы программы необходим Node.js.
    echo Скачать можно здесь: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] Node.js найден: 
node --version
echo.

:: Проверка наличия npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm не найден!
    pause
    exit /b 1
)

echo [2/3] npm найден:
npm --version
echo.

:: Создание папок
echo [3/3] Создание необходимых папок...
if not exist "uploads" mkdir uploads
if not exist "node_modules" (
    echo.
    echo Установка зависимостей...
    echo Это может занять несколько минут...
    echo.
    
    :: Установка зависимостей (локально)
    call npm install --loglevel=error
    
    if %errorlevel% neq 0 (
        echo.
        echo [ОШИБКА] Не удалось установить зависимости!
        echo.
        pause
        exit /b 1
    )
) else (
    echo Папка node_modules уже существует, пропускаем установку...
)

echo.
echo ========================================
echo   ✅ Установка успешно завершена!
echo ========================================
echo.
echo Для запуска приложения выполните: start.bat
echo.
pause