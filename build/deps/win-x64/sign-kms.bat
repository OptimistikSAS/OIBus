@echo off
REM build/sign-kms.bat
REM Force PowerShell to run the signing script
echo "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sign-kms.ps1" "%1"