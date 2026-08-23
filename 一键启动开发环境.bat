@echo off
chcp 65001 >nul
title 刷吧 (Shuaba) - 本地开发环境启动器

echo ========================================================
echo          🚀 正在启动「刷吧」桌面端开发环境...
echo ========================================================
echo.

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (推荐 v20+): https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Rust
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Rust/Cargo，请先安装 Rust: https://rustup.rs/
    pause
    exit /b 1
)

:: 安装依赖
if not exist "node_modules\" (
    echo 📦 首次启动，正在安装依赖包 (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络后重试。
        pause
        exit /b 1
    )
)

echo.
echo 🎯 正在启动 Tauri 桌面热重载开发服务器...
call npm run app

pause
