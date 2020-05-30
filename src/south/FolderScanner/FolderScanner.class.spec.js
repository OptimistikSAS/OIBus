const FolderScanner = require('./FolderScanner.class')

const engine = {}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('folder-scanner', () => {
  it('should check file properly', () => {
    const dataSource = {
      dataSourceId: 'fileid',
      protocol: 'FolderScanner',
      enabled: true,
      points: [],
      scanMode: 'every10Seconds',
      FolderScanner: {
        inputFolder: 'inputFolder',
        preserve: false,
        minAge: 300,
        regex: '.*test-file.*csv$',
      },
    }
    const folderScanner = new FolderScanner(dataSource, engine)
    // check created Object (is it a useful test?)
    expect(folderScanner).toMatchSnapshot()
  })
})
