const vscode = require('vscode')

function getProvider (document, range, context, token) {
  const codeActions = []

  context.diagnostics.forEach(diagnostic => {
    diagnostic.answers.forEach(message => {
      codeActions.push(generateForFix({ document, message, range: diagnostic.range }))
    })
    codeActions.push(generateForSkip({ document, diagnostic }))
  })

  return codeActions
}

function generateForFix ({ document, message, range }) {
  const codeAction = new vscode.CodeAction(message, vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [{ document, message, range }],
    command: 'dandy.fix'
  }

  return codeAction
}

function generateForSkip ({ document, diagnostic }) {
  const codeAction = new vscode.CodeAction('건너뛰기', vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [diagnostic],
    command: 'dandy.skip'
  }

  return codeAction
}

module.exports = {
  provideCodeActions: getProvider
}
