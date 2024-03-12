@echo off

title Install OIBus as Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    goto EOF
)

set c=
set n="OIBus"

:PARSE_PARAMETERS
set parameter=%~1
if "%parameter%"=="" goto PARSE_PARAMETERS_DONE
if "%parameter:~0,1%"=="-" (
    set %parameter:~1%=%~2
    shift
    shift
    goto PARSE_PARAMETERS
)
:PARSE_PARAMETERS_DONE

goto CHECK
:INPUT
SET /P c=Enter the directory in which you want to save all your OIBus related data, caches, and logs (example: C:\OIBusData):
:CHECK
if "%c%"==""  (
    goto INPUT
)

if not exist "%c%" mkdir %c%

echo Stopping %n% service...
nssm.exe stop %n% >nul 2>&1

@echo Installing %n% as Windows service...
date /T >> install.log
time /T >> install.log
nssm.exe install "%n%" "%cd%\oibus-launcher.exe --config %c%"
@echo nssm.exe install "%n%" "%cd%\oibus-launcher.exe --config %c%" >> install.log

nssm.exe set "%n%" Application "%cd%\oibus-launcher.exe"
@echo nssm.exe set "%n%" Application "%cd%\oibus-launcher.exe" >> install.log

nssm.exe set "%n%" AppParameters "--config %c%"
@echo nssm.exe set "%n%" AppParameters "--config %c%" >> install.log

nssm.exe set "%n%" AppDirectory "%cd%"
@echo nssm.exe set "%n%" AppDirectory "%cd%" >> install.log
nssm.exe set "%n%" AppNoConsole 1 >> install.log
@echo nssm.exe set "%n%" AppNoConsole 1
@echo Starting "%n%" service...
nssm.exe start "%n%"
@echo Creating go.bat
@echo> go.bat echo Stopping "%n%" service... You can restart it from the Windows Service Manager
@echo>> go.bat nssm.exe stop "%n%"
@echo>> go.bat "%cd%\oibus-launcher.exe" --config "%c%"
type go.bat
