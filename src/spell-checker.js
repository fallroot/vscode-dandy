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
        resolve({
          errors: parse(body),
          text
        })
      }
    })
  })
}

function parse (text) {
  const startIndex = text.indexOf('data = [{')
  const nextIndex = text.indexOf('pages = data.length;')

  if (startIndex < 0 || nextIndex < 0) return

  const data = JSON.parse(text.substring(startIndex + 8, nextIndex - 4))

  return build(data.errInfo)
}

function build (data) {
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

module.exports = {
  execute
}
