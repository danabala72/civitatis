Set WshShell = CreateObject("WScript.Shell")

WshShell.CurrentDirectory = "C:\Users\ANU\Project\civitatis"

WshShell.Run "cmd /c pnpm parse-only", 0, False