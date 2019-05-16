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
  const startIndex = text.indexOf('data = [{')
  const nextIndex = text.indexOf('pages = data.length;')

  if (startIndex < 0 || nextIndex < 0) throw Error('failedToFindJson')

  const rawData = text.substring(startIndex + 7, nextIndex - 3)
  const data = JSON.parse(`{"pages":${rawData}}`)

  return build(data.pages)
}

function build (pages) {
  const keywords = []
  const result = []

  pages.forEach(page => {
    page.errInfo.forEach(error => {
      const keyword = error.orgStr

      if (keywords.includes(keyword)) return

      keywords.push(keyword)
      result.push({
        after: error.candWord.split(/\s*\|\s*/).filter(s => s.length > 0),
        before: keyword,
        help: unescapeHtmlEntity(error.help.replace(/<br\/?>/gi, '\n'))
      })
    })
  })

  return result
}

// 맞춤법 검사기의 출력 결과에 따라 HTML 엔티티를 추가할 수 있다.
function unescapeHtmlEntity (text) {
  return text.replace(/&apos;/g, '\'')
}

module.exports = {
  execute
}
