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
SET /P CONFIG_PATH=Enter the directory in which you want to save all your OIBus related data, caches, and logs (example: C:\OIBusData):

:CHECK
if "%CONFIG_PATH:~-5%" neq "\" (
    echo %CONFIG_PATH% is not a valid folder
    goto INPUT
)

echo Stopping OIBus service...
nssm.exe stop OIBus >nul 2>&1

@echo Installing OIBus as Windows service...
date /T >> install.log
time /T >> install.log
nssm.exe install OIBus "%cd%\oibus.exe" "--config ""%CONFIG_PATH%"""
@echo nssm.exe install OIBus "%cd%\oibus.exe" "--config ""%CONFIG_PATH%""" >> install.log
nssm.exe set OIBus AppDirectory "%cd%"
@echo nssm.exe set OIBus AppDirectory "%cd%" >> install.log
nssm set OIBus AppNoConsole 1 >> install.log
@echo nssm set OIBus AppNoConsole 1
@echo Starting OIBus service...
nssm.exe start OIBus
@echo Creating go.bat
@echo> go.bat echo Stopping OIBus service... You can restart it from the Windows Service Manager
@echo>> go.bat nssm.exe stop OIBus
@echo>> go.bat "%cd%\oibus.exe" --config "%CONFIG_PATH%"
type go.bat

