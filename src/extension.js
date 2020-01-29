const vscode = require('vscode')
const codeActionProvider = require('./code-action-provider')
const spellChecker = require('./spell-checker')

// collection is a per-extension Map<document.uri, diagnostics[]>
const collection = vscode.languages.createDiagnosticCollection('dandy')
// const resultMap = new WeakMap()

function activate (context) {
  const subs = context.subscriptions

  subs.push(vscode.commands.registerTextEditorCommand('dandy.run', run))
  subs.push(vscode.commands.registerCommand('dandy.fix', fix))
  subs.push(vscode.commands.registerCommand('dandy.skip', skip))
  subs.push(vscode.commands.registerCommand('dandy.addToException', addToException))
  subs.push(vscode.languages.registerCodeActionsProvider(['markdown', 'plaintext'], codeActionProvider))
  subs.push(vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument))
  subs.push(vscode.workspace.onDidCloseTextDocument(onDidCloseTextDocument))
  subs.push(vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument))
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
  const startOffset = empty ? 0 : document.offsetAt(selection.start);

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '맞춤법 검사를 진행하고 있습니다.'
    },
    async (progress) => {
      return new Promise(async (resolve, reject) =>  {
      try {
        const texts = splitter(text, 8000);
        const errors = [];
        var splitStart = startOffset;
        for (const t of texts) {

          const result = await spellChecker.execute(t);

          for (error of result.errors) {
            error.start += splitStart;
            error.end += splitStart;
            errors.push(error);
          }
          splitStart += t.length;
        }
        setCollections(document, errors);
        resolve();
      } catch (error) {
        vscode.window.showInformationMessage(error);
        reject(error);
      }
    })
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
  // 해당 diagnostic은 onDidChangeTextDocument 에서 삭제됨
}

function skip (diagnostic) {
  const uri = getDocument().uri;
  const diagnostics = collection.get(uri).slice()
  const index = diagnostics.indexOf(diagnostic)
  if (index < 0) return
  diagnostics.splice(index, 1)
  collection.set(uri, diagnostics)
}

async function addToException(word) {
  // 예외처리할 word를 workspace별 dictionary에 저장
  const config = vscode.workspace.getConfiguration("dandy")
  let words = config.get('exceptWords');
  if (!words) words = []
  if (!words.includes(word)) {
    words.push(word);
    words.sort();
  }
  // Diagnostic에서 같은 단어 삭제
  const doc = getDocument();
  const diags = collection.get(doc.uri);
  const newDiags = diags.filter(diag => doc.getText(diag.range)!=word);
  collection.set(doc.uri, newDiags);
  // workspace .vscode/settings.json에 저장
  await config.update('exceptWords', words, vscode.ConfigurationTarget.workspace);
}

function setCollections(document, errors) {
  const text = document.getText()
  const diagnostics = []
  const config = vscode.workspace.getConfiguration("dandy")
  let exceptWords = config.get('exceptWords');
  if (!exceptWords) exceptWords = []

  for (error of errors) {
    if (!exceptWords.includes(error.before)) { // 예외처리 단어 제외
      const keyword = error.before
      const range = new vscode.Range(
        document.positionAt(error.start),
        document.positionAt(error.end));
      const diagnostic = new vscode.Diagnostic(range, error.help, vscode.DiagnosticSeverity.Error)
      diagnostic.answers = error.after
      diagnostic.document = document
      diagnostic.error = error
      // 문서가 편집된 후에 offset 값을 알아내기 어려우므로 추가 field에 저장해둔다.
      diagnostic.startOffset = error.start;
      diagnostic.endOffset = error.end;
      diagnostics.push(diagnostic)
    }
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
  const changes = event.contentChanges;
  if (!changes || changes.length==0) 
    return;
  for(const changed of changes) {
    const offsetInc = changed.text.length - changed.rangeLength;
      
    const diags = collection.get(event.document.uri);
    const newDiags = []
    const document = event.document;
    for(d of diags) {
      if (d.range.end.isBeforeOrEqual(changed.range.start))
        newDiags.push(d);
      else if (d.range.start.isAfterOrEqual(changed.range.end)) { 
        // d.range는 편집 전의 document를 기준으로 좌표를 가지고 있기 때문에
        // 지금 시점에서 document.offsetAt으로 offset을 계산할 수 없음. 때문에 별도로 저장해놓은 offset값을 이용
        const start=document.positionAt(offsetInc+d.startOffset);
        const end=document.positionAt(offsetInc+d.endOffset);
        d.range = new vscode.Range(start, end);
        d.startOffset += offsetInc;
        d.endOffset += offsetInc;
        newDiags.push(d);
      } else {
        // diag에 접하는 영역을 편집시에는 diag를 삭제해버리자.
      }
    }
    collection.set(event.document.uri, newDiags);
  }
}

function onDidCloseTextDocument(document) {
  if (document && document.uri) {
    collection.delete(document.uri);
  }
}

function onDidSaveTextDocument(document) {
  if (document && document.uri) {
    collection.set(document.uri, []);
  }
}

module.exports = {
  activate
}
