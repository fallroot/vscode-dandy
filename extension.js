const vscode = require('vscode')
const request = require('request')

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dandy')
let errors = []

function activate (context) {
  const subs = context.subscriptions

  subs.push(vscode.commands.registerCommand('extension.dandy.run', run))
  subs.push(vscode.commands.registerCommand('extension.dandy.fix', fix))
  subs.push(
    vscode.languages.registerCodeActionsProvider('plaintext', {
      provideCodeActions
    })
  )
  subs.push(diagnosticCollection)
  subs.push(vscode.workspace.onDidChangeTextDocument(e => {
    setCollections(e.document.getText(), errors)
  }))
}

function run () {
  const editor = vscode.window.activeTextEditor

  if (!editor) {
    return
  }

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

  if (startIndex < 0 || nextIndex < 0) {
    return
  }

  const data = JSON.parse(text.substring(startIndex + 8, nextIndex - 4))

  errors = parseErrors(data.errInfo)
}

function parseErrors (data) {
  return data.map(item => {
    return {
      after: item.candWord,
      before: item.orgStr,
      help: item.help
    }
  })
}

function fix ({ document, message, range }) {
  let edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, range, message)
  vscode.workspace.applyEdit(edit)
}

function setCollections (source, errors) {
  const diagnostics = []
  let fromIndex

  errors.forEach(error => {
    const index = source.indexOf(error.before, fromIndex)

    if (index < 0) {
      return
    }

    const range = indexToRange(index, error.before)
    const diagnostic = new vscode.Diagnostic(range, error.after, vscode.DiagnosticSeverity.Error)

    diagnostics.push(diagnostic)
    fromIndex = index
  })

  diagnosticCollection.set(vscode.window.activeTextEditor.document.uri, diagnostics)
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
    const messages = diagnostic.message.split(/\s*\|\s*/).filter(s => s.length > 0)

    messages.forEach(message => {
      codeActions.push(generateCodeAction({ document, message, range: diagnostic.range }))
    })
  })

  return codeActions
}

function generateCodeAction ({ document, message, range }) {
  const codeAction = new vscode.CodeAction(message, vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [{ document, message, range }],
    title: 'CodeAction\'s Title',
    command: 'extension.dandy.fix'
  }

  return codeAction
}

module.exports = {
  activate
}
