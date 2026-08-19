@echo off

title Install OIBus as Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if ERRORLEVEL 1 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    exit /b 1
)

set DATA_FOLDER_PATH=
set "SERVICE_NAME=OIBus"
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

rem The service name ends up as a Windows service name, a registry key path segment, and a
rem raw argument to sc.exe/nssm.exe/reg.exe - so anything outside this safe set (quotes,
rem backslashes, shell metacharacters such as & | > < ^) could corrupt those commands or
rem break out of their intended argument. Reject it outright rather than trying to escape
rem it differently for every consumer.
echo %SERVICE_NAME%| findstr /r /v /c:"^[A-Za-z0-9 ._-]*$" >nul
if not ERRORLEVEL 1 (
    echo ERROR: Service name "%SERVICE_NAME%" contains characters that are not allowed.
    echo Allowed characters: letters, digits, spaces, dots, hyphens and underscores.
    exit /b 1
)

rem -port is embedded as a raw (unquoted) JSON number below, so it must be digits only.
echo %OIBUS_PORT%| findstr /r "^[0-9]*$" >nul
if ERRORLEVEL 1 (
    echo ERROR: Port "%OIBUS_PORT%" must contain digits only.
    exit /b 1
)

goto CHECK
:INPUT
SET /P DATA_FOLDER_PATH=Enter the directory in which you want to save all your OIBus related data, caches, and logs (example: C:\OIBusData):
:CHECK
if "%DATA_FOLDER_PATH%"==""  (
    goto INPUT
)

rem A literal " in the data directory could break out of the quoted arguments it is later
rem embedded in (nssm AppParameters, go.bat) - and it is not a legal Windows path character
rem anyway, so rejecting it costs nothing legitimate.
echo %DATA_FOLDER_PATH%| findstr /c:"\"" >nul
if not ERRORLEVEL 1 (
    echo ERROR: The data directory must not contain a " character.
    exit /b 1
)

if not exist "%DATA_FOLDER_PATH%" mkdir "%DATA_FOLDER_PATH%"

rem Every OIBus instance must have its own binaries folder and its own data folder. Check
rem the machine-wide instance registry (HKLM\SOFTWARE\OIBus\Instances, shared with the
rem graphical installer) before touching anything, so two instances can never end up
rem sharing either one.
set "APP_DIR=%cd%"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "CHECK_DATA_DIR=%DATA_FOLDER_PATH%"
if not "%CHECK_DATA_DIR:~-2%"==":\" if "%CHECK_DATA_DIR:~-1%"=="\" set "CHECK_DATA_DIR=%CHECK_DATA_DIR:~0,-1%"

set "CONFLICT_NAME="
set "CONFLICT_KIND="
for /f "delims=" %%K in ('reg query "HKLM\SOFTWARE\OIBus\Instances" 2^>nul') do call :CHECK_INSTANCE_CONFLICT "%%K"
if defined CONFLICT_NAME (
    echo ERROR: The %CONFLICT_KIND% is already used by OIBus instance "%CONFLICT_NAME%".
    echo Each OIBus instance must have its own installation folder and its own data directory.
    exit /b 1
)

if exist "%DATA_FOLDER_PATH%\oibus.db" goto SKIP_INIT
rem Unlike the service name, username/password are free-text credentials that must accept
rem any character (restricting a password's charset would be the wrong fix) - so escape
rem them for safe embedding in JSON instead of rejecting anything.
set "ESCAPED_ADMIN_USERNAME=%ADMIN_USERNAME:\=\\%"
set "ESCAPED_ADMIN_USERNAME=%ESCAPED_ADMIN_USERNAME:"=\"%"
set "ESCAPED_ADMIN_PASSWORD=%ADMIN_PASSWORD:\=\\%"
set "ESCAPED_ADMIN_PASSWORD=%ESCAPED_ADMIN_PASSWORD:"=\"%"
set JSON_FIELDS="engineName":"%SERVICE_NAME%"
if not "%ADMIN_USERNAME%"=="" set JSON_FIELDS=%JSON_FIELDS%,"adminUsername":"%ESCAPED_ADMIN_USERNAME%"
if not "%ADMIN_PASSWORD%"=="" set JSON_FIELDS=%JSON_FIELDS%,"adminPassword":"%ESCAPED_ADMIN_PASSWORD%"
if not "%OIBUS_PORT%"=="" set JSON_FIELDS=%JSON_FIELDS%,"port":%OIBUS_PORT%
(echo {%JSON_FIELDS%})> "%DATA_FOLDER_PATH%\oibus.init.json"
:SKIP_INIT

echo Stopping %SERVICE_NAME% service...
nssm.exe stop "%SERVICE_NAME%" >nul 2>&1

@echo Installing %SERVICE_NAME% as Windows service...
date /T >> install.log
time /T >> install.log
nssm.exe install "%SERVICE_NAME%" "%cd%\oibus-launcher.exe"
@echo nssm.exe install "%SERVICE_NAME%" "%cd%\oibus-launcher.exe" >> install.log

nssm.exe set "%SERVICE_NAME%" Application "%cd%\oibus-launcher.exe"
@echo nssm.exe set "%SERVICE_NAME%" Application "%cd%\oibus-launcher.exe" >> install.log

nssm.exe set "%SERVICE_NAME%" AppParameters "--config \"%DATA_FOLDER_PATH%\""
@echo nssm.exe set "%SERVICE_NAME%" AppParameters "--config \"%DATA_FOLDER_PATH%\"" >> install.log

nssm.exe set "%SERVICE_NAME%" AppDirectory "%cd%"
@echo nssm.exe set "%SERVICE_NAME%" AppDirectory "%cd%" >> install.log
nssm.exe set "%SERVICE_NAME%" AppNoConsole 1 >> install.log
@echo nssm.exe set "%SERVICE_NAME%" AppNoConsole 1
@echo Starting "%SERVICE_NAME%" service...
nssm.exe start "%SERVICE_NAME%"

rem Record this instance in the same machine-wide registry the graphical installer uses,
rem so future installs (script- or wizard-based) can detect folder/data clashes against it.
reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%" /v DataDir /t REG_SZ /d "%DATA_FOLDER_PATH%" /f >nul
reg add "HKLM\SOFTWARE\OIBus\Instances\%SERVICE_NAME%" /v AppDir /t REG_SZ /d "%APP_DIR%" /f >nul
reg add "HKLM\SOFTWARE\OIBus\Instances\%SERVICE_NAME%" /v DataDir /t REG_SZ /d "%DATA_FOLDER_PATH%" /f >nul

@echo Creating go.bat
@echo> go.bat echo Stopping "%SERVICE_NAME%" service... You can restart it from the Windows Service Manager
@echo>> go.bat nssm.exe stop "%SERVICE_NAME%"
@echo>> go.bat "%cd%\oibus-launcher.exe" --config "%DATA_FOLDER_PATH%"
type go.bat

exit /b 0

rem --- Subroutines ---

rem Called once per subkey found under HKLM\SOFTWARE\OIBus\Instances. Sets CONFLICT_NAME /
rem CONFLICT_KIND (in the caller's scope) if this OTHER instance (any name but our own)
rem already claims our chosen installation folder or data directory.
:CHECK_INSTANCE_CONFLICT
setlocal
set "SUBKEY=%~1"
set "OTHER_NAME=%SUBKEY:HKEY_LOCAL_MACHINE\SOFTWARE\OIBus\Instances\=%"
if /I "%OTHER_NAME%"=="%SERVICE_NAME%" (
    endlocal
    exit /b 0
)
set "OTHER_APPDIR="
set "OTHER_DATADIR="
for /f "tokens=2,*" %%A in ('reg query "%SUBKEY%" /v AppDir 2^>nul ^| find "AppDir"') do set "OTHER_APPDIR=%%B"
for /f "tokens=2,*" %%A in ('reg query "%SUBKEY%" /v DataDir 2^>nul ^| find "DataDir"') do set "OTHER_DATADIR=%%B"
if "%OTHER_APPDIR:~-1%"=="\" set "OTHER_APPDIR=%OTHER_APPDIR:~0,-1%"
if not "%OTHER_DATADIR:~-2%"==":\" if "%OTHER_DATADIR:~-1%"=="\" set "OTHER_DATADIR=%OTHER_DATADIR:~0,-1%"
set "MATCH_KIND="
if /I "%OTHER_APPDIR%"=="%APP_DIR%" set "MATCH_KIND=installation folder"
if /I "%OTHER_DATADIR%"=="%CHECK_DATA_DIR%" set "MATCH_KIND=data directory"
endlocal & if not "%MATCH_KIND%"=="" (set "CONFLICT_NAME=%OTHER_NAME%" & set "CONFLICT_KIND=%MATCH_KIND%")
exit /b 0
