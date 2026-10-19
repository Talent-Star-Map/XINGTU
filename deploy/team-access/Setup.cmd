@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0XingtuAccess.ps1" -Action Setup -Repo "%~dp0..\.."
if errorlevel 1 pause
