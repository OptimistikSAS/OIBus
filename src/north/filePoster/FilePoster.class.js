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
    // `${user}:${password}@${host}:${port}${path}`
    const { host, user, password, port, path } = this.application.FilePoster
    const readStream = fs.createReadStream(file)
    // To do, after the verification with good authorisation, the url should be replaced by the 
    // variables: `${host}:${port}${path}` for exemple
    fetch('https://demo.oianalytics.fr:443/api/optimistik/data/values/upload', {
      body: readStream,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorisation: `Basic ${user}:${password}` },
      method: 'POST',
    })
      .then(res => res.json())
      .then((json) => {
        console.info(json)
        if (json.status === 200) {
          this.engine.notifyEnd(file)
        }
      })
  }
}

module.exports = FilePoster
