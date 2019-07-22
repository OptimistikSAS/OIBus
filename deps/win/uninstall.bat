@echo off

title Remove OIBus from Windows service

echo Administrator permissions required. Detecting permission...

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Stopping OIBus service...
    START nssm.exe stop OIBus

    echo Removing OIBus service...
    START nssm.exe remove OIBus confirm
) else (
    echo No Administrator permission. Please run Command Prompt as Administrator
)
