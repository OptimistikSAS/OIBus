@echo off

title Remove OIBus from Windows service

echo Administrator permissions required. Detecting permission...
net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo No Administrator permission. Please run Command Prompt as Administrator
    pause
    goto EOF
)

set n="OIBus"

:PARSE_PARAMETERS
if "%~1"=="" goto PARSE_PARAMETERS_DONE
if "%~1"=="-n" (
    set "n=%~2"
    shift
    shift
    goto PARSE_PARAMETERS
)
shift
goto PARSE_PARAMETERS
:PARSE_PARAMETERS_DONE


echo Stopping "%n%" service...
nssm.exe stop "%n%"

echo Removing "%n%" service...
nssm.exe remove "%n%" confirm
pause
