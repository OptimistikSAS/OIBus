@echo off

title Remove OIBus from Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if ERRORLEVEL 1 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    pause
    exit /b 1
)

set SERVICE_NAME="OIBus"

:PARSE_PARAMETERS
if "%~1"=="" goto PARSE_PARAMETERS_DONE
if "%~1"=="-n" (
    set "SERVICE_NAME=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
shift
goto PARSE_PARAMETERS
:PARSE_PARAMETERS_DONE


echo Stopping "%SERVICE_NAME%" service...
nssm.exe stop "%SERVICE_NAME%"

echo Removing "%SERVICE_NAME%" service...
nssm.exe remove "%SERVICE_NAME%" confirm
pause
