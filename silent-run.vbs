Set WshShell = CreateObject("WScript.Shell")

WshShell.CurrentDirectory = "C:\Users\ANU\Project\civitatis"

WshShell.Run "cmd /c pnpm start", 0, False