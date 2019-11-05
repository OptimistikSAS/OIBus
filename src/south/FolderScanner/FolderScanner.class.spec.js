const fs = require('fs')
const FolderScanner = require('./FolderScanner.class')

// Mock database service
jest.mock('../../services/database.service', () => {
})

// Mock nodejs fs api
jest.mock('fs')

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return { silly: () => jest.fn() }
}))

const engine = { }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('folder-scanner', () => {
  it('should check file properly', () => {
    fs.statSync.mockReturnValue({ mtimeMs: 100 })

    const dataSource = {
      FolderScanner: {
        inputFolder: 'inputFolder',
        preserveFiles: true,
        minAge: 300,
        regex: '.*test-file.*csv$',
      },
    }
    const folderScanner = new FolderScanner(dataSource, engine)
    const filename = 'my-test-file.csv'
    const checkResult = folderScanner.checkFile(filename)
    expect(checkResult).toBe(true)
  })
})
