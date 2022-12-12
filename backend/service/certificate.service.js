import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Class used to manage certificate files and their content
 */
export default class CertificateService {
  constructor(logger) {
    this.logger = logger
    this.privateKey = null
    this.cert = null
    this.ca = null
  }

  async init(privateKeyFilePath, certFilePath, caFilePath) {
    if (privateKeyFilePath) {
      try {
        this.privateKey = await fs.readFile(path.resolve(privateKeyFilePath))
      } catch (error) {
        this.logger.error(`Key file "${privateKeyFilePath}" does not exist: ${error}`)
      }
    }
    if (certFilePath) {
      try {
        this.cert = await fs.readFile(path.resolve(certFilePath))
      } catch (error) {
        this.logger.error(`Cert file "${certFilePath}" does not exist: ${error}`)
      }
    }
    if (caFilePath) {
      try {
        this.ca = await fs.readFile(path.resolve(caFilePath))
      } catch (error) {
        this.logger.error(`CA file "${caFilePath}" does not exist: ${error}`)
      }
    }
  }
}
