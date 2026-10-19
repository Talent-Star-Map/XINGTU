@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0XingtuAccess.ps1" -Action Connect
if errorlevel 1 pause
