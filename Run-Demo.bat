@echo off
setlocal

set "BASE_URL=https://fable-stores-nfc-menu.vercel.app"
set "TENANT_SLUG=demo"
set "PROFILE=%~1"

if "%PROFILE%"=="" set "PROFILE=first-run"

if /I "%PROFILE%"=="first-run" (
  set "FEED=first-run"
) else if /I "%PROFILE%"=="rush-hour" (
  set "FEED=rush-hour"
) else if /I "%PROFILE%"=="full" (
  set "FEED=full-story"
) else (
  set "PROFILE=first-run"
  set "FEED=first-run"
)

where npm >nul 2>nul
if errorlevel 1 goto fallback

call npm run demo:open -- --base-url %BASE_URL% --tenant-slug %TENANT_SLUG% --profile %PROFILE% --auto-feed --auto-next
if errorlevel 1 goto fallback

echo Demo launch complete.
goto end

:fallback
echo npm unavailable or launcher failed. Opening fallback guided page in default browser...
start "" "%BASE_URL%/r/%TENANT_SLUG%?next=/demo?feed=%FEED%%%26autoNext=1"
echo Opened fallback guided page.

:end
endlocal
