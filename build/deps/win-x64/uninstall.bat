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

echo Stopping "%SERVICE_NAME%" service...
nssm.exe stop "%SERVICE_NAME%"

echo Removing "%SERVICE_NAME%" service...
nssm.exe remove "%SERVICE_NAME%" confirm

rem Remove this instance from the machine-wide registry so its folder/data directory can
rem be reused (this does not touch actual data - only the conflict-tracking registration).
reg delete "HKLM\SOFTWARE\OIBus\Instances\%SERVICE_NAME%" /f >nul 2>&1

pause
