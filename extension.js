const vscode = require('vscode')
const diagnosticCollection = vscode.languages.createDiagnosticCollection('dandy')
let errors = []

function activate (context) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.dandy.run', run))
  context.subscriptions.push(vscode.commands.registerCommand('extension.dandy.fix', fix))
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('plaintext', {
      provideCodeActions
    })
  )
  context.subscriptions.push(diagnosticCollection)
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
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

  errors = parseErrors()

  // addCollections(text, ['if', 'function'])
  setCollections(text, errors)
}

function parseErrors () {
  return data[0].errInfo.map(item => {
    return {
      after: item.candWord,
      before: item.orgStr,
      help: item.help
    }
  })
}

function fix (document, diagnostic) {
  let edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, diagnostic.range, diagnostic.message)
  vscode.workspace.applyEdit(edit)

  // diagnostics.splice(diagnostics.indexOf(diagnostic), 1)
  // diagnosticCollection.set(document.uri, diagnostics)
  // setCollections(vscode.window.activeTextEditor.document.getText(), errors)
}

function setCollections (source, errors) {
  const diagnostics = []
  let fromIndex

  errors.forEach(error => {
    const index = source.indexOf(error.before, fromIndex)

    if (index < 0) {
      return
    }

    console.log(error.before, index)

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
    const codeAction = new vscode.CodeAction(diagnostic.message, vscode.CodeActionKind.QuickFix)
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

const data = [
  {
    'str': '중고 직거래 앱(응용프로그램)으로 유명한 당근마켓은 지난해 경기 판교에서 서울 서초역 인근으로 사무실을 옮겼다. 직원들의 출퇴근 때문이었다. 당근마켓 관계자는 \u201c판교까지 출근하는 게 부담스럽다는 개발자들을 고려했다\u201d고 설명했다. 서초동에서 사세를 확장한 당근마켓은 조만간 서울 역삼동으로 다시 이전한다.\r\n\r\n본격화한 \u2018판교 엑소더스\u2019\r\n\r\n\u2018한국의 실리콘밸리\u2019로 불리는 판교를 떠나는 스타트업(신생 벤처기업)이 늘고 있다. 임대료와 교통 측면에서 득보다 실이 많다는 이유에서다.\r\n\r\n해외송금 스타트업 소다크루도 지난해 판교에서 삼성역 인근의 공유오피스로 자리를 옮겼다. 소다크루 관계자는 \u201c서울에 있으니 직원을 채용하거나 벤처캐피털(VC)과 미팅하는 게 더 수월해졌다\u201d고 말했다.\r\n\r\n판교를 떠난 스타트업 대다수는 해당 지역을 떠난 이유로 교통을 꼽았다. 신분당선 개통으로 강남역 간 이동시간이 20분으로 줄었지만 이동 지역이 여의도, 광화문이라면 얘기가 달라진다. 차라도 갖고 나가면 넉넉잡고 1시간30분을 이동해야 하는 상황이 된다. 교통 문제는 직원 채용에도 악영향을 준다. 거주 지역이 판교 인근이거나 강남권이라면 출퇴근에 별 무리가 없지만 강북만 하더라도 판교 출퇴근을 주저하는 경우가 많다는 설명이다.\r\n\r\n임대료가 저렴한 것도 아니다. 판교 일대의 사무실 임대료는 평당 5만~6만원 수준으로 강남권과 비슷하다. 이미 가격이 역전됐다는 분석도 나온다. 강남에 공유오피스가 우후죽순 들어서면서 임대료를 깎아주는 사례가 많아졌기 때문이다. 판교에 공유오피스가 드물다는 점도 \u2018판교 엑소더스\u2019의 원인 중 하나다. 직원이 5명 미만인 스타트업이라면 통째로 사무실을 빌려야 하는 판교를 고집할 이유가 없다는 지적이다.\r\n\r\n판교에 본사를 둔 한 스타트업 대표는 \u201c판교는 부동산 임대료가 비싸고 생활비도 많이 드는 지역\u201d이라며 \u201c유명하거나 규모가 큰 스타트업이라면 몰라도 시작한 지 얼마 되지 않은 업체로선 판교가 부담스러울 수 있다\u201d고 설명했다. 동떨어진 지리와 비싼 물가 때문에 개발자를 찾지 못해 골머리를 앓는 미국 실리콘밸리와 비슷한 현상이 판교에도 나타나고 있다는 얘기다.',
    'errInfo': [
      {
        'help': '지역정보 오류입니다. 지역에 대한 접미사나 전후 지역정보를 다시 한번 확인해 보시길 바랍니다.',
        'errorIdx': 0,
        'start': 152,
        'end': 160,
        'orgStr': '서울 역삼동으로',
        'candWord': '서울 강남구 역삼동으로|'
      },
      {
        'help': '띄어쓰기 오류입니다. 대치어를 참고하여 띄어 쓰도록 합니다.',
        'errorIdx': 1,
        'start': 282,
        'end': 287,
        'orgStr': '소다크루도',
        'candWord': '소다 크루도'
      },
      {
        'help': '띄어쓰기 오류입니다. 대치어를 참고하여 띄어 쓰도록 합니다.',
        'errorIdx': 2,
        'start': 321,
        'end': 325,
        'orgStr': '소다크루',
        'candWord': '소다 크루|소다크래커'
      },
      {
        'help': '[복합어 오류] 의미상 두 단어가 복합어를 만들기 어렵습니다. 그러니 입력 오류가 없다면 적당히 띄어 씁니다. 물론, 본 철자 검사 과정의 오류일 수도 있으니 이 도움말은 참고만 하시길 바랍니다.',
        'errorIdx': 3,
        'start': 442,
        'end': 447,
        'orgStr': '이동시간이',
        'candWord': '이동 시간이'
      },
      {
        'help': '단위를 나타내는 명사는 띄어 씁니다. 특히 수관형사와 함께 사용하는 경우를 흔히 보는데 이때 뒤에 오는 의존명사(단위명사)와 띄어 씁니다.<br/><br/>(예) 몇 개월, 십오 년, 한두 마리, 서너 명, 두 가지,<br/>두어 개, 차 한 대, 금 서 돈, 소 한 마리, 1조 원, 1백억 원<br/><br/>또한, 수를 적을 때는 &quot;만(萬)&quot; 단위로 띄어 씁니다.<br/><br/>(예) 십이억 삼천사백오십육만 칠천팔백구십팔<br/>12억 3456만 7898',
        'errorIdx': 4,
        'start': 504,
        'end': 511,
        'orgStr': '1시간30분을',
        'candWord': '1시간 30분을'
      },
      {
        'help': '대등하거나 종속적인 절이 이어질 때는 절과 절 사이에 반점을 씁니다. 반드시 쓰지 않아도 되지만, 반점을 쓰게 되면 절을 쉽게 구분할 수 있고, 뜻을 쉽게 파악할 수 있으며, 쉬어가는 부분이 있어서 글을 읽기도 편합니다.',
        'errorIdx': 5,
        'start': 586,
        'end': 593,
        'orgStr': '없지만 강북만',
        'candWord': '없지만, 강북만'
      }
    ],
    'idx': 0
  }
]

module.exports = {
  activate
}
