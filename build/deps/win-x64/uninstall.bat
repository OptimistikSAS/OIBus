@echo off

title Remove OIBus from Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if ERRORLEVEL 1 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    pause
    exit /b 1
)

set "SERVICE_NAME=OIBus"

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

rem The service name ends up as a Windows service name, a registry key path segment, and a
rem raw argument to sc.exe/nssm.exe/reg.exe - so anything outside this safe set (quotes,
rem backslashes, shell metacharacters such as & | > < ^) could corrupt those commands or
rem break out of their intended argument. Reject it outright rather than trying to escape
rem it differently for every consumer.
echo %SERVICE_NAME%| findstr /r /v "^[A-Za-z0-9 ._-]*$" >nul
if not ERRORLEVEL 1 (
    echo ERROR: Service name "%SERVICE_NAME%" contains characters that are not allowed.
    echo Allowed characters: letters, digits, spaces, dots, hyphens and underscores.
    pause
    exit /b 1
)

rem Look up the data directory for this service BEFORE removing the service - "nssm remove"
rem deletes the whole Services\<name> registry key, DataDir value included.
set "DATA_DIR="
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%" /v DataDir 2^>nul ^| find "DataDir"') do set "DATA_DIR=%%B"

echo Stopping "%SERVICE_NAME%" service...
nssm.exe stop "%SERVICE_NAME%"

if defined DATA_DIR (
    set /p DELETE_DATA=Do you wish to remove all data for service %SERVICE_NAME% (cache, logs...)? (y/N)
    if /I "%DELETE_DATA%"=="Y" (
        rem cache/error/archive are independent top-level folders (not nested under each
        rem other), and logs/ bundles both logs.db and metrics.db.
        if exist "%DATA_DIR%\cache" rd /s /q "%DATA_DIR%\cache"
        if exist "%DATA_DIR%\error" rd /s /q "%DATA_DIR%\error"
        if exist "%DATA_DIR%\archive" rd /s /q "%DATA_DIR%\archive"
        if exist "%DATA_DIR%\logs" rd /s /q "%DATA_DIR%\logs"
        if exist "%DATA_DIR%\certs" rd /s /q "%DATA_DIR%\certs"
        if exist "%DATA_DIR%\oibus.db" del /f /q "%DATA_DIR%\oibus.db"
        if exist "%DATA_DIR%\crypto.db" del /f /q "%DATA_DIR%\crypto.db"
        rem Only succeeds if now empty - matches the graphical installer's behavior of
        rem leaving any other stray file in place rather than force-deleting the folder.
        rd "%DATA_DIR%" 2>nul
    )
)

echo Removing "%SERVICE_NAME%" service...
nssm.exe remove "%SERVICE_NAME%" confirm

rem Remove this instance from the machine-wide registry so its folder/data directory can
rem be reused (this does not touch actual data - only the conflict-tracking registration).
reg delete "HKLM\SOFTWARE\OIBus\Instances\%SERVICE_NAME%" /f >nul 2>&1

pause
