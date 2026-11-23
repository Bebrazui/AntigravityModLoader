Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
launcherJs = userProfile & "\.antigravity-mods\loader\launcher.js"

' Forward all CLI arguments
argsStr = ""
For Each arg In WScript.Arguments
  argsStr = argsStr & " """ & arg & """"
Next

' Run via node or wscript silently (0 = hide window)
cmd = "node """ & launcherJs & """" & argsStr
WshShell.Run cmd, 0, False
