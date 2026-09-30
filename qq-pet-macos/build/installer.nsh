!macro customHeader
  !define MUI_DIRECTORYPAGE_TEXT_TOP "建议选择非系统保护目录（如 D 盘）以便保存游戏数据"
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 "是否保留用户数据（userdata 与 config.json）？" IDYES keepData
    RMDir /r "$INSTDIR\userdata"
    Delete "$INSTDIR\config.json"
  keepData:
!macroend
