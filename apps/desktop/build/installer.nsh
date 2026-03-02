!macro customInstall
  DetailPrint "Instalando Microsoft Visual C++ Redistributable..."
  ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart'
!macroend
