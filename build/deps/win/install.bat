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

:initial
if "%1"=="" goto done
echo              %1
set aux=%1
if "%aux:~0,1%"=="-" (
   set nome=%aux:~1,250%
) else (
   set "%nome%=%1"
   set nome=
)
shift
goto initial
:done


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
nssm.exe install %n% "%cd%\oibus-launcher.exe" "--config ""%c%"""
@echo nssm.exe install %n% "%cd%\oibus-launcher.exe" "--config ""%c%""" >> install.log
nssm.exe set %n% AppDirectory "%cd%"
@echo nssm.exe set %n% AppDirectory "%cd%" >> install.log
nssm set OIBus AppNoConsole 1 >> install.log
@echo nssm set %n% AppNoConsole 1
@echo Starting %n% service...
nssm.exe start %n%
@echo Creating go.bat
@echo> go.bat echo Stopping %n% service... You can restart it from the Windows Service Manager
@echo>> go.bat nssm.exe stop %n%
@echo>> go.bat "%cd%\oibus-launcher.exe" --config "%c%"
type go.bat
