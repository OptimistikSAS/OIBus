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

echo Stopping %n% service...
START nssm.exe stop %n%

echo Removing %n% service...
START nssm.exe remove %n% confirm
pause

