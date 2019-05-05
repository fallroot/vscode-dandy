const vscode = require('vscode')
const diagnosticCollection = vscode.languages.createDiagnosticCollection('dandy')
const diagnosticMap = []

function activate (context) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.dandy.run', run))
  context.subscriptions.push(vscode.commands.registerCommand('extension.dandy.fix', fix))
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('plaintext', {
      provideCodeActions
    })
  )
  context.subscriptions.push(diagnosticCollection)
}

function run () {
  const editor = vscode.window.activeTextEditor

  if (!editor) {
    return
  }

  const selection = editor.selection
  const text = editor.document.getText(selection.isEmpty ? undefined : selection)

  addCollections(text, ['if', 'function'])
}

function fix (document, diagnostic) {
  let edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, diagnostic.range, diagnostic.message)
  vscode.workspace.applyEdit(edit)

  diagnosticMap.splice(diagnosticMap.indexOf(diagnostic), 1)
  diagnosticCollection.set(document.uri, diagnosticMap)
}

function addCollections (source, keywords) {
  let fromIndex

  keywords.forEach(keyword => {
    const index = source.indexOf(keyword, fromIndex)

    if (index < 0) {
      return
    }

    const range = indexToRange(index, keyword)
    const diagnostic = new vscode.Diagnostic(range, `!${keyword}!`, vscode.DiagnosticSeverity.Error)

    diagnosticMap.push(diagnostic)
    fromIndex = index
  })

  diagnosticCollection.set(vscode.window.activeTextEditor.document.uri, diagnosticMap)
}

function indexToRange (index, keyword) {
  const document = vscode.window.activeTextEditor.document
  const start = document.positionAt(index)
  const end = start.translate(0, keyword.length)

  return new vscode.Range(start, end)
}

function provideCodeActions (document, range, context, token) {
  const codeActions = []

  context.diagnostics.forEach(diagnostic => {
    const codeAction = new vscode.CodeAction('Fix this', vscode.CodeActionKind.QuickFix)
    codeAction.command = {
      arguments: [document, diagnostic],
      // title: 'Info Title',
      command: 'extension.dandy.fix'
    }
    // infoAction.diagnostics = [diagnostic]
    codeActions.push(codeAction)
  })

  return codeActions
}

module.exports = {
  activate
}
