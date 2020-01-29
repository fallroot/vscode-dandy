const vscode = require('vscode')

function getProvider (document, range, context, token) {
  const codeActions = []

  context.diagnostics.forEach(diagnostic => {
    diagnostic.answers.forEach(message => {
      codeActions.push(makeQuickFixCommand('"'+message+'"', [{document, message, range: diagnostic.range}], "dandy.fix"))
    })
    codeActions.push(makeQuickFixCommand("건너뛰기",[diagnostic],"dandy.skip" ))
    codeActions.push(makeQuickFixCommand("예외추가",[document.getText(range)],"dandy.addToException"))
  })

  return codeActions
}

function makeQuickFixCommand(menuTitle, commandArgs, commandName) {
  const codeAction = new vscode.CodeAction(menuTitle, vscode.CodeActionKind.QuickFix)
  codeAction.command = {
    arguments: commandArgs,
    command: commandName
  }
  return codeAction
}

module.exports = {
  provideCodeActions: getProvider
}
