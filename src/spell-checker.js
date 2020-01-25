const request = require('request')

function execute (text) {
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
        try {
          resolve({ errors: parse(body), text })
        } catch (e) {
          reject(e)
        }
      }
    })
  })
}

function parse (text) {
  // index of first opening bracket
  const startIndex = text.indexOf('data = [{')
  // index of semicolon after last closing bracket
  const nextIndex = text.indexOf('}];\n')

  if (startIndex < 0 || nextIndex < 0) throw Error('failedToFindJson')

  // JSON data except trailing semicolon
  const rawData = text.substring(startIndex + 7, nextIndex + 2)
  const data = JSON.parse(`{"pages":${rawData}}`)

  return build(data.pages)
}

function build (pages) {
  const keywords = []
  const result = []

  pages.forEach(page => {
    page.errInfo.forEach(error => {
      const keyword = error.orgStr
      keywords.push(keyword)
      result.push({
        after: error.candWord.split(/\s*\|\s*/).filter(s => s.length > 0),
        before: keyword,
        start: error.start,
        end: error.end,
        help: unescapeHtmlEntity(error.help.replace(/<br\/?>/gi, '\n'))
      })
    })
  })

  return result
}

// 맞춤법 검사기의 출력 결과에 따라 HTML 엔티티를 추가할 수 있다.
function unescapeHtmlEntity (text) {
  return text.replace(/&amp;/g, '&')
    .replace(/&apos;/g, '\'')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
}

module.exports = {
  execute
}
