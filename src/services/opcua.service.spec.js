const fs = require('fs/promises')
const path = require('path')

const { initOpcuaCertificateFolders } = require('./opcua.service')

describe('opcua service', () => {
  it('should copy certificates', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => {
      throw new Error('does not exist')
    })
    jest.spyOn(path, 'join').mockImplementationOnce(() => 'stubFolder')
    fs.copyFile = jest.fn()
    fs.mkdir = jest.fn()

    await initOpcuaCertificateFolders('certFolder')
    expect(fs.mkdir).toHaveBeenCalledTimes(10)
  })
})
