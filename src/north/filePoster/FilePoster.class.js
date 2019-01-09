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

  /**
   * @param {*} file: The address of the file
   * @memberof FilePoster
   * @return {void}
   */
  postFile(file) {
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

    // `${user}:${password}@${host}:${port}${path}`
    const { host, user, password, port, path } = this.application.FilePoster
    const readStream = fs.createReadStream(file)
    fetch('https://demo.oianalytics.fr:443/api/optimistik/data/values/upload', {
      body: readStream,
      headers: { /* 'Content-Type': 'application/x-www-form-urlencoded', */ Authorisation: `${user}:${password}` },
      method: 'POST',
    })
      .then(res => res.json())
      .then((json) => {
        console.info(json)
        if (json === 200) {
          this.engine.notifyEnd(file)
        }
      })
  }
}

module.exports = FilePoster
