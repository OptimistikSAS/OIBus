@echo off

title Install OIBus as Windows service

echo Administrator permissions required. Detecting permission...

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Stopping OIBus service...
    START nssm.exe stop OIBus

    echo Installing OIBus as Windows service...
    START nssm.exe install OIBus "%cd%\oibus.exe"
    START nssm.exe set OIBus AppDirectory "%cd%"

    echo Starting OIBus service...
    START nssm.exe start OIBus
) else (
    echo No Administrator permission. Please run Command Prompt as Administrator
)
