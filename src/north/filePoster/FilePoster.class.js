const http = require('http')
const fetch = require('node-fetch')
const fs = require('fs')
const ApiHandler = require('../ApiHandler.class')

class FilePoster extends ApiHandler {
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.currentObject = {}
    this.engine.register('postFile', this.postFile.bind(this))
  }

  postFile(file) {
    this.abc = 0
    // fs.readFile(file, (err, postData) => {
    //   if (err) throw err
    // const username = 'QFPELALDNSUO6BUV8SJ'
    // const password = 'vQ9mEU1ZN1TIarYQOhM0fF2X8EtqExa5LAm0rxOy'
    // const options = {
    //   hostname: 'demo.oianalytics.fr',
    //   port: 443,
    //   path: '/api/optimistik/data/values/upload',
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //     'Content-Length': Buffer.byteLength(postData),
    //     Authorisation: `${username}:${password}`,
    //   },
    //   auth: `${username}:${password}`,
    // }

    // const req = http.request(options, (res) => {
    //   console.log('res:', { res })
    //   console.log(`Status Code: ${res.statusCode}`)
    //   console.log(`Headers: ${JSON.stringify(res.headers)}`)
    //   res.setEncoding('utf8')
    //   res.on('data', (chunk) => {
    //     console.log(`Body: ${chunk}`)
    //   })
    //   res.on('end', () => {
    //     console.log('Ended')
    //   })
    // })

    // req.on('error', (e) => {
    //   console.error(`Error: ${e.message}`)
    // })

    // req.write(file)
    // req.end()
    // })

    const username = 'QFPELALDNSUO6BUV8SJ'
    const password = 'vQ9mEU1ZN1TIarYQOhM0fF2X8EtqExa5LAm0rxOy'
    fetch('QFPELALDNSUO6BUV8SJ:vQ9mEU1ZN1TIarYQOhM0fF2X8EtqExa5LAm0rxOy@demo.oianalytics.fr', {
      body: file,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorisation: `${username}:${password}` },
      method: 'POST',
    })
  }
}

module.exports = FilePoster
