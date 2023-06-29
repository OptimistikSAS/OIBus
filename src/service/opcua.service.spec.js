const fs = require("fs").promises;
import path from 'path'
import { createFolder } from './utils.js'

import { initOpcuaCertificateFolders } from './opcua.service.js'

jest.mock('./utils')

describe('opcua service', () => {
  it('should copy certificates', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => {
      throw new Error('does not exist')
    })
    jest.spyOn(path, 'join').mockImplementationOnce(() => 'stubFolder')
    fs.copyFile = jest.fn()

    await initOpcuaCertificateFolders('certFolder')
    expect(createFolder).toHaveBeenCalledTimes(10)
  })
})
