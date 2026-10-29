@echo off
rem Serve this folder over local HTTP so local images in the txt can be embedded.
setlocal
cd /d "%~dp0"
set "PORT=8765"
set "PYEXE="

where python >nul 2>nul
if errorlevel 1 goto TRY_PY
python -c "import sys" >nul 2>nul
if errorlevel 1 goto TRY_PY
set "PYEXE=python"
goto HAVE_PY

:TRY_PY
where py >nul 2>nul
if errorlevel 1 goto NOPY
py -3 -c "import sys" >nul 2>nul
if errorlevel 1 goto NOPY
set "PYEXE=py -3"

:HAVE_PY
echo Starting local server at http://127.0.0.1:%PORT%/ ...
echo Close this window to stop the server.
start "" /b %PYEXE% -m http.server %PORT% --bind 127.0.0.1
ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:%PORT%/index.html"
goto :EOF

:NOPY
echo Python was not found or is broken. Opening index.html directly...
echo Note: local images will NOT be embedded when opened this way.
start "" "%~dp0index.html"
