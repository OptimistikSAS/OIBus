const fs = require('fs/promises')

/**
 * Class used to manage certificate files and their content
 */
class CertificateService {
  constructor(logger) {
    this.logger = logger
    this.privateKey = null
    this.cert = null
    this.ca = null
  }

  async init(keyFile, certFile, caFile) {
    if (keyFile) {
      try {
        const stat = await fs.stat(keyFile)
        if (stat) {
          this.privateKey = await fs.readFile(keyFile)
        } else {
          this.logger.error(`Key file ${keyFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading key file ${keyFile}: ${error}`)
        return
      }
    }
    if (certFile) {
      try {
        const stat = await fs.stat(certFile)
        if (stat) {
          this.cert = await fs.readFile(certFile)
        } else {
          this.logger.error(`Cert file ${certFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading cert file ${certFile}: ${error}`)
      }
    }
    if (caFile) {
      try {
        const stat = await fs.stat(caFile)
        if (stat) {
          this.ca = await fs.readFile(caFile)
        } else {
          this.logger.error(`CA file ${caFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading ca file ${caFile}: ${error}`)
      }
    }
  }
}

module.exports = CertificateService
