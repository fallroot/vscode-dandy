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

function run() {

    const editor = getEditor()

    if (!editor) return

    const document = editor.document;
    const selection = editor.selection;
    const empty = selection.isEmpty;
    // 맞춤법 서버로 전송한 텍스트가 Windows 포맷, 즉 CR LF로 줄바꿈되어 있더라도
    // 결과의 오프셋 값은 CR 만의 줄바꿈 기준으로 되어 있다. 이 때문에 오차가 생기는 
    // 것을 방지하기 위해 LF를 공백으로 대체하여 보냄
    const text = document.getText(empty ? undefined : selection).replace(/\n/g, ' ');
    const startOffset = empty? 0 : document.offsetAt(selection.start);

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '맞춤법 검사를 진행하고 있습니다.'
      },
      async () =>  {
        const texts = splitter(text, 8000);
        const errors = [];
        var splitStart  = startOffset;
        for(const t of texts) {
          const result = await spellChecker.execute(t);
          for(error of result.errors) {
              error.start += splitStart;
              error.end += splitStart;
              errors.push(error);
          }
          splitStart += t.length;
        }
        resultMap.set(document, errors);
        setCollections(document);
      }
    );
}

// limit 길이 한도 내에서 문장 단위로 split
function splitter(str, limit) {
  const sentences = str.match( /[^\.!\?]+[\.!\?]+/g );
  const splits = [];
  var partial = "";
  sentences.forEach(s=> {
      if (partial.length+s.length>limit) {
          splits.push(partial);
          partial=s;
      } else {
          partial+=s;
      }
  });
  if (partial.length>1)
      splits.push(partial);
  return splits;
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

  for (error of errors) {
    const keyword = error.before
      const range = new vscode.Range(
        document.positionAt(error.start), 
        document.positionAt(error.end));
      const diagnostic = new vscode.Diagnostic(range, error.help, vscode.DiagnosticSeverity.Error)
      diagnostic.answers = error.after
      diagnostic.document = document
      diagnostic.error = error
      diagnostics.push(diagnostic)
  }

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
