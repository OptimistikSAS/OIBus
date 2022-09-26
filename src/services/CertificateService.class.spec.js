const fs = require('node:fs/promises')

const path = require('path')
const CertificateService = require('./CertificateService.class')

jest.mock('node:fs/promises')

const keyFilePath = 'myKeyFile'
const certFilePath = 'myCertFile'
const caFilePath = 'myCAFile'
let certificateService = null

describe('Certificate service', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    certificateService = new CertificateService()
  })

  it('should properly initialized certificate service', async () => {
    await certificateService.init()
    expect(fs.readFile).toHaveBeenCalledTimes(0)

    await certificateService.init(keyFilePath, certFilePath, caFilePath)
    expect(fs.readFile).toHaveBeenCalledTimes(3)
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(keyFilePath))
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(certFilePath))
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(caFilePath))
  })

  it('should properly log errors', async () => {
    certificateService.logger = { error: jest.fn() }
    fs.readFile.mockImplementation(() => {
      throw new Error('read error')
    })

    await certificateService.init(keyFilePath, certFilePath, caFilePath)
    expect(certificateService.logger.error).toHaveBeenCalledTimes(3)
    expect(certificateService.logger.error).toHaveBeenCalledWith(`Key file "${keyFilePath}" does not exist: Error: read error`)
    expect(certificateService.logger.error).toHaveBeenCalledWith(`Cert file "${certFilePath}" does not exist: Error: read error`)
    expect(certificateService.logger.error).toHaveBeenCalledWith(`CA file "${caFilePath}" does not exist: Error: read error`)
  })
})
