Set WshShell = CreateObject("WScript.Shell")

WshShell.CurrentDirectory = "C:\Users\USER\Project\civitatis"

WshShell.Run "cmd /c pnpm start", 0, False