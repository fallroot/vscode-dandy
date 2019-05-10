const vscode = require('vscode')
const request = require('request')

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dandy')
let errors = []

function activate (context) {
  const subs = context.subscriptions

  subs.push(vscode.commands.registerTextEditorCommand('extension.dandy.run', run))
  subs.push(vscode.commands.registerCommand('extension.dandy.fix', fix))
  subs.push(vscode.commands.registerCommand('extension.dandy.fixAll', fixAll))
  subs.push(vscode.commands.registerCommand('extension.dandy.skip', skip))
  subs.push(vscode.languages.registerCodeActionsProvider('plaintext', { provideCodeActions }))
  subs.push(diagnosticCollection)
  subs.push(vscode.workspace.onDidChangeTextDocument(e => {
    setCollections(e.document.getText(), errors)
  }))
}

function run () {
  const editor = getEditor()

  if (!editor) return

  const selection = editor.selection
  const text = editor.document.getText(selection.isEmpty ? undefined : selection)

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '맞춤법 검사를 진행하고 있습니다.'
  }, () => {
    return new Promise(resolve => {
      requestCheck(text, resolve)
    })
  })
}

function requestCheck (text, resolve) {
  const options = {
    uri: 'http://speller.cs.pusan.ac.kr/results',
    method: 'POST',
    form: {
      text1: text
    }
  }
  request.post(options, (error, httpResponse, body) => {
    resolve()

    if (error) {
      vscode.window.showErrorMessage('맞춤법 검사기 서버에 접속할 수 없습니다.')
    } else {
      parseResponse(body)
      setCollections(text, errors)
    }
  })
}

function parseResponse (text) {
  const startIndex = text.indexOf('data = [{')
  const nextIndex = text.indexOf('pages = data.length;')

  if (startIndex < 0 || nextIndex < 0) return

  const data = JSON.parse(text.substring(startIndex + 8, nextIndex - 4))

  errors = parseErrors(data.errInfo)
}

function parseErrors (data) {
  return data.map(item => {
    return {
      after: item.candWord.split(/\s*\|\s*/).filter(s => s.length > 0),
      before: item.orgStr,
      end: item.end,
      help: item.help.replace(/<br\/?>/gi, '\n'),
      start: item.start
    }
  })
}

function fix ({ document, message, range }) {
  let edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, range, message)
  vscode.workspace.applyEdit(edit)
}

function fixAll () {
  const uri = getDocument().uri
  const diagnostics = diagnosticCollection.get(uri)
  const edit = new vscode.WorkspaceEdit()

  diagnostics.forEach(diagnostic => edit.replace(uri, diagnostic.range, diagnostic.answers[0]))
  vscode.workspace.applyEdit(edit).then(() => diagnosticCollection.clear()).catch(console.error)
}

function skip (diagnostic) {
  const uri = getDocument().uri
  let diagnostics = diagnosticCollection.get(uri).slice()
  const index = diagnostics.indexOf(diagnostic)

  if (index < 0) return

  errors.splice(errors.indexOf(diagnostic.error), 1)
  diagnostics.splice(index, 1)
  diagnosticCollection.set(uri, diagnostics)
}

function setCollections (source, errors) {
  const document = getDocument()
  const diagnostics = []

  errors.forEach(error => {
    const range = new vscode.Range(document.positionAt(error.start), document.positionAt(error.end))
    const diagnostic = new vscode.Diagnostic(range, error.help, vscode.DiagnosticSeverity.Error)

    diagnostic.answers = error.after
    diagnostic.error = error
    diagnostics.push(diagnostic)
  })

  diagnosticCollection.set(document.uri, diagnostics)
}

function provideCodeActions (document, range, context, token) {
  const codeActions = []

  context.diagnostics.forEach(diagnostic => {
    diagnostic.answers.forEach(message => {
      codeActions.push(generateCodeAction({ document, message, range: diagnostic.range }))
    })
    codeActions.push(generateSkipCodeAction({ document, diagnostic }))
  })

  return codeActions
}

function generateCodeAction ({ document, message, range }) {
  const codeAction = new vscode.CodeAction(message, vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [{ document, message, range }],
    command: 'extension.dandy.fix'
  }

  return codeAction
}

function generateSkipCodeAction ({ document, diagnostic }) {
  const codeAction = new vscode.CodeAction('건너뛰기', vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [diagnostic],
    command: 'extension.dandy.skip'
  }

  return codeAction
}

function getDocument () {
  const editor = getEditor()

  if (!editor) return

  return editor.document
}

function getEditor () {
  return vscode.window.activeTextEditor
}

module.exports = {
  activate
}
