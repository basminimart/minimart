@echo off
setlocal
echo ======================================================
echo 🛠️  Minimart POS - AutoStart Setup
echo ======================================================
echo.
echo [*] Adding Minimart POS to Windows Startup folder...

:: Get full path of the run script
set "RUN_PATH=%~dp0run_minimart.bat"

:: Create a VBScript to create a shortcut
set "VBS_SCRIPT=%temp%\create_shortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = oWS.ExpandEnvironmentStrings("%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\MinimartPOS.lnk") >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%RUN_PATH%" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%~dp0" >> "%VBS_SCRIPT%"
echo oLink.Description = "Start Minimart POS on boot" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

:: Run the VBScript and delete it
cscript //nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

echo.
echo [OK] DONE! Now when you turn on your PC, the POS will start automatically.
echo.
echo Press any key to finish...
pause > nul
