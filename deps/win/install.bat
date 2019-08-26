@echo off

title Install OIBus as Windows service

if NOT "%~1" == "" (
    echo Administrator permissions required. Detecting permission...

    net session >nul 2>&1
    if %errorLevel% == 0 (
        echo Stopping OIBus service...
        START nssm.exe stop OIBus

        echo Installing OIBus as Windows service...
        START nssm.exe install OIBus "%cd%\oibus.exe" "--config %~1"
        START nssm.exe set OIBus AppDirectory "%cd%"

        echo Starting OIBus service...
        START nssm.exe start OIBus
    ) else (
        echo No Administrator permission. Please run Command Prompt as Administrator
    )
) else (
    echo Config file location missing. Usage: install.bat C:\OIBus\oibus.json
)
