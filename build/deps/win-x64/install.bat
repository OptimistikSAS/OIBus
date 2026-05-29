@echo off

title Install OIBus as Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    goto EOF
)

set DATA_FOLDER_PATH=
set SERVICE_NAME="OIBus"
set ADMIN_USERNAME=
set ADMIN_PASSWORD=
set OIBUS_PORT=

:PARSE_PARAMETERS
if "%~1"=="" goto PARSE_PARAMETERS_DONE
if "%~1"=="-n" (
    set "SERVICE_NAME=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
if "%~1"=="-c" (
    set "DATA_FOLDER_PATH=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
if "%~1"=="-u" (
    set "ADMIN_USERNAME=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
if "%~1"=="-p" (
    set "ADMIN_PASSWORD=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
if "%~1"=="-port" (
    set "OIBUS_PORT=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
shift
goto PARSE_PARAMETERS
:PARSE_PARAMETERS_DONE

goto CHECK
:INPUT
SET /P DATA_FOLDER_PATH=Enter the directory in which you want to save all your OIBus related data, caches, and logs (example: C:\OIBusData):
:CHECK
if "%DATA_FOLDER_PATH%"==""  (
    goto INPUT
)

if not exist "%DATA_FOLDER_PATH%" mkdir %DATA_FOLDER_PATH%

if not exist "%DATA_FOLDER_PATH%\oibus.db" (
    if "%ADMIN_USERNAME%"=="" set /P ADMIN_USERNAME=Enter the admin username (default: admin):
    if "%ADMIN_USERNAME%"=="" set ADMIN_USERNAME=admin
    if "%ADMIN_PASSWORD%"=="" set /P ADMIN_PASSWORD=Enter the admin password (default: pass):
    if "%ADMIN_PASSWORD%"=="" set ADMIN_PASSWORD=pass
    if "%OIBUS_PORT%"=="" set /P OIBUS_PORT=Enter the port OIBus will listen on (default: 2223):
    if "%OIBUS_PORT%"=="" set OIBUS_PORT=2223
    powershell -Command "$json = [pscustomobject]@{adminUsername=$env:ADMIN_USERNAME; adminPassword=$env:ADMIN_PASSWORD; port=[int]$env:OIBUS_PORT} | ConvertTo-Json -Compress; [IO.File]::WriteAllText([IO.Path]::Combine($env:DATA_FOLDER_PATH, 'oibus.init.json'), $json)"
)

echo Stopping %SERVICE_NAME% service...
nssm.exe stop %SERVICE_NAME% >nul 2>&1

@echo Installing %SERVICE_NAME% as Windows service...
date /T >> install.log
time /T >> install.log
nssm.exe install "%SERVICE_NAME%" "%cd%\oibus-launcher.exe --config %DATA_FOLDER_PATH%"
@echo nssm.exe install "%SERVICE_NAME%" "%cd%\oibus-launcher.exe --config %DATA_FOLDER_PATH%" >> install.log

nssm.exe set "%SERVICE_NAME%" Application "%cd%\oibus-launcher.exe"
@echo nssm.exe set "%SERVICE_NAME%" Application "%cd%\oibus-launcher.exe" >> install.log

nssm.exe set "%SERVICE_NAME%" AppParameters "--config %DATA_FOLDER_PATH%"
@echo nssm.exe set "%SERVICE_NAME%" AppParameters "--config %DATA_FOLDER_PATH%" >> install.log

nssm.exe set "%SERVICE_NAME%" AppDirectory "%cd%"
@echo nssm.exe set "%SERVICE_NAME%" AppDirectory "%cd%" >> install.log
nssm.exe set "%SERVICE_NAME%" AppNoConsole 1 >> install.log
@echo nssm.exe set "%SERVICE_NAME%" AppNoConsole 1
@echo Starting "%SERVICE_NAME%" service...
nssm.exe start "%SERVICE_NAME%"
@echo Creating go.bat
@echo> go.bat echo Stopping "%SERVICE_NAME%" service... You can restart it from the Windows Service Manager
@echo>> go.bat nssm.exe stop "%SERVICE_NAME%"
@echo>> go.bat "%cd%\oibus-launcher.exe" --config "%DATA_FOLDER_PATH%"
type go.bat
