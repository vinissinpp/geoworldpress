' Roda a atualização sem abrir janela (usado pela tarefa agendada do Windows)
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "node """ & pasta & "\atualizar.js""", 0, True
