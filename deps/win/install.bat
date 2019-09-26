@echo off

title Install OIBus as Windows service

echo Administrator permissions required. Detecting permission...

net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    goto EOF
)

set "CONFIG_PATH=%~1"

goto CHECK

:INPUT
SET /P CONFIG_PATH=Enter the path for the config file (Example: C:\OIBus\oibus.json):

:CHECK
if "%CONFIG_PATH:~-5%" neq ".json" (
    echo %CONFIG_PATH% is not a valid config file path
    goto INPUT
)

echo Stopping OIBus service...
START nssm.exe stop OIBus

echo Installing OIBus as Windows service...
START nssm.exe install OIBus "%cd%\oibus.exe" "--config ""%~1"""
START nssm.exe set OIBus AppDirectory "%cd%"

echo Starting OIBus service...
START nssm.exe start OIBus

:EOF
