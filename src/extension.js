const vscode = require('vscode')
const request = require('request')

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dandy')
let errors = []

function activate (context) {
  const subs = context.subscriptions

  subs.push(vscode.commands.registerTextEditorCommand('dandy.run', run))
  subs.push(vscode.commands.registerCommand('dandy.fix', fix))
  subs.push(vscode.commands.registerCommand('dandy.fixAll', fixAll))
  subs.push(vscode.commands.registerCommand('dandy.skip', skip))
  subs.push(vscode.languages.registerCodeActionsProvider('plaintext', { provideCodeActions }))
  subs.push(vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument))
  subs.push(diagnosticCollection)
}

function run () {
  const editor = getEditor()

  if (!editor) return

  const selection = editor.selection
  const empty = selection.isEmpty
  const text = editor.document.getText(empty ? undefined : selection)

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '맞춤법 검사를 진행하고 있습니다.'
  }, () => {
    return requestCheck(text).then(body => {
      parseResponse(body)
      setCollections(text, errors)
    })
  })
}

function getTextInfo () {
  const editor = getEditor()
  const document = editor.document
  const selection = editor.selection
  const empty = selection.isEmpty
  const text = document.getText(empty ? undefined : selection)
  const result = {
    document,
    editor,
    selection,
    text
  }

  if (empty) {
    result.end = 0
    result.start = 0
  } else {
    result.end = document.offsetAt(selection.end)
    result.start = document.offsetAt(selection.start)
  }

  return result
}

function requestCheck (text) {
  return new Promise((resolve, reject) => {
    const options = {
      uri: 'http://speller.cs.pusan.ac.kr/results',
      method: 'POST',
      form: {
        text1: text
      }
    }

    request.post(options, (error, response, body) => {
      if (error) {
        reject(error)
      } else {
        resolve(body)
      }
    })
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
  const keywords = []
  const result = []

  data.forEach(item => {
    const keyword = item.orgStr

    if (keywords.includes(keyword)) return

    keywords.push(keyword)
    result.push({
      after: item.candWord.split(/\s*\|\s*/).filter(s => s.length > 0),
      before: keyword,
      help: item.help.replace(/<br\/?>/gi, '\n')
    })
  })

  return result
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
  const info = getTextInfo()
  const document = getDocument()
  const diagnostics = []

  errors.forEach(error => {
    const keyword = error.before
    let index = info.text.indexOf(keyword)

    while (index >= 0) {
      const start = document.positionAt(index)
      const end = document.positionAt(index + keyword.length)
      const range = new vscode.Range(start, end)
      const diagnostic = new vscode.Diagnostic(range, error.help, vscode.DiagnosticSeverity.Error)

      diagnostic.answers = error.after
      diagnostic.error = error
      diagnostics.push(diagnostic)

      index = info.text.indexOf(keyword, index + 1)
    }
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
    command: 'dandy.fix'
  }

  return codeAction
}

function generateSkipCodeAction ({ document, diagnostic }) {
  const codeAction = new vscode.CodeAction('건너뛰기', vscode.CodeActionKind.QuickFix)

  codeAction.command = {
    arguments: [diagnostic],
    command: 'dandy.skip'
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

function onDidChangeTextDocument (event) {
  if (errors.length > 0) {
    setCollections(event.document.getText(), errors)
  }
}

module.exports = {
  activate
}
