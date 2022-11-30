import fs from 'node:fs/promises'
import path from 'node:path'

import { initOpcuaCertificateFolders } from './opcua.service.js'

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
