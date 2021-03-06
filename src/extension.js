const vscode = require('vscode')
const codeActionProvider = require('./code-action-provider')
const spellChecker = require('./spell-checker')

const collection = vscode.languages.createDiagnosticCollection('dandy')
const resultMap = new WeakMap()

function activate (context) {
  const subs = context.subscriptions

  subs.push(vscode.commands.registerTextEditorCommand('dandy.run', run))
  subs.push(vscode.commands.registerCommand('dandy.fix', fix))
  subs.push(vscode.commands.registerCommand('dandy.fixAll', fixAll))
  subs.push(vscode.commands.registerCommand('dandy.skip', skip))
  subs.push(vscode.languages.registerCodeActionsProvider(['markdown', 'plaintext'], codeActionProvider))
  subs.push(vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument))
  subs.push(collection)
}

function run () {
  const editor = getEditor()

  if (!editor) return

  const document = editor.document
  const selection = editor.selection
  const empty = selection.isEmpty
  const text = document.getText(empty ? undefined : selection)

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '맞춤법 검사를 진행하고 있습니다.'
  }, () => {
    return spellChecker.execute(text).then(result => {
      resultMap.set(document, result.errors)
      setCollections(document)
    })
  })
}

function fix ({ document, message, range }) {
  let edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, range, message)
  vscode.workspace.applyEdit(edit)
}

function fixAll () {
  const document = getDocument()
  const uri = document.uri
  const diagnostics = collection.get(uri)
  const edit = new vscode.WorkspaceEdit()

  diagnostics.forEach(diagnostic => edit.replace(uri, diagnostic.range, diagnostic.answers[0]))
  vscode.workspace.applyEdit(edit).then(() => collection.clear()).catch(console.error)
}

function skip (diagnostic) {
  const document = getDocument()
  const uri = document.uri
  let diagnostics = collection.get(uri).slice()
  const index = diagnostics.indexOf(diagnostic)

  if (index < 0) return

  const errors = resultMap.get(document)

  resultMap.set(document, errors.splice(errors.indexOf(diagnostic.error), 1))
  diagnostics.splice(index, 1)
  collection.set(uri, diagnostics)
}

function setCollections (document, errors) {
  const text = document.getText()
  const diagnostics = []

  if (errors === undefined) {
    errors = resultMap.get(document)
  }

  errors.forEach(error => {
    const keyword = error.before
    let index = text.indexOf(keyword)

    while (index >= 0) {
      const start = document.positionAt(index)
      const end = document.positionAt(index + keyword.length)
      const range = new vscode.Range(start, end)
      const diagnostic = new vscode.Diagnostic(range, error.help, vscode.DiagnosticSeverity.Error)

      diagnostic.answers = error.after
      diagnostic.document = document
      diagnostic.error = error
      diagnostics.push(diagnostic)

      index = text.indexOf(keyword, index + 1)
    }
  })

  collection.set(document.uri, diagnostics)
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
  const document = event.document
  const errors = resultMap.get(document)

  if (errors && errors.length > 0) {
    setCollections(document, errors)
  }
}

module.exports = {
  activate
}
