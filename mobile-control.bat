@echo off
REM Quick launcher for mobile control features

:menu
cls
echo ========================================
echo    Mobile Control Menu
echo ========================================
echo.
echo 1. Test Connection
echo 2. Control Phone (USB)
echo 3. Control Phone (Wireless)
echo 4. Clipboard Sync (Watch Mode)
echo 5. Push Clipboard to Phone
echo 6. Pull Clipboard from Phone
echo 7. Setup WiFi Connection
echo 8. Exit
echo.
set /p choice="Select option (1-8): "

if "%choice%"=="1" goto test
if "%choice%"=="2" goto control
if "%choice%"=="3" goto wireless
if "%choice%"=="4" goto watch
if "%choice%"=="5" goto push
if "%choice%"=="6" goto pull
if "%choice%"=="7" goto wifi
if "%choice%"=="8" goto end
goto menu

:test
echo.
echo Testing connection...
call npm run mobile:test
pause
goto menu

:control
echo.
echo Starting phone control (USB)...
echo Press Ctrl+C to stop
call npm run mobile:control
pause
goto menu

:wireless
echo.
echo Starting phone control (Wireless)...
echo Press Ctrl+C to stop
call npm run mobile:wireless
pause
goto menu

:watch
echo.
echo Starting clipboard sync...
echo This will run continuously. Press Ctrl+C to stop
call npm run clipboard:watch
pause
goto menu

:push
echo.
echo Pushing clipboard to phone...
call npm run clipboard:push
pause
goto menu

:pull
echo.
echo Pulling clipboard from phone...
call npm run clipboard:pull
pause
goto menu

:wifi
echo.
echo ========================================
echo WiFi Connection Setup
echo ========================================
echo.
echo Step 1: Make sure phone is connected via USB
echo Step 2: Enable WiFi ADB on phone
pause
echo.
echo Enabling WiFi ADB...
adb tcpip 5555
echo.
echo Step 3: Find your phone's IP address
echo   Settings ^> About Phone ^> Status ^> IP address
echo.
set /p phoneip="Enter phone IP address: "
echo.
echo Connecting to %phoneip%:5555...
adb connect %phoneip%:5555
echo.
echo Testing connection...
adb devices
echo.
echo If you see your device listed, WiFi is ready!
echo You can now disconnect USB cable.
pause
goto menu

:end
echo.
echo Goodbye!
exit /b 0
