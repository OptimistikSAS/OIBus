const databaseService = require('./database.service')

const values = [
  { timestamp: '2022-08-25T12:58:00.000Z', data: { value: 1, quality: 192 }, pointId: 'point001' },
  { timestamp: '2022-08-25T12:59:00.000Z', data: { value: 2, quality: 192 }, pointId: 'point002' },
]

let all
let get
let run
let iterate
let prepare
let mockDatabase

jest.mock('better-sqlite3', () => () => (mockDatabase))

beforeEach(() => {
  jest.useFakeTimers()

  const retrievedValues = values.map((value) => ({
    ...value,
    data: encodeURI(JSON.stringify(value.data)),
  }))
  all = jest.fn().mockReturnValue([{ path: 'myFilePath', timestamp: 123 }])
  get = jest.fn().mockReturnValue(retrievedValues)
  run = jest.fn()
  iterate = jest.fn().mockReturnValue(retrievedValues)
  prepare = jest.fn()
  prepare.mockReturnValue({
    all,
    get,
    run,
    iterate,
  })
  mockDatabase = { prepare }
})

describe('Database services', () => {
  it('should create values database', () => {
    const expectedDatabase = databaseService.createValuesDatabase('myDb.db')
    expect(prepare).toHaveBeenCalledTimes(4)
    expect(prepare).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS cache ('
        + 'id INTEGER PRIMARY KEY, '
        + 'timestamp TEXT KEY, '
        + 'data TEXT, '
        + 'point_id TEXT, '
        + 'south TEXT);')
    expect(prepare).toHaveBeenCalledWith('PRAGMA secure_delete = OFF;')
    expect(prepare).toHaveBeenCalledWith('PRAGMA cache_size = 100000;')
    expect(prepare).toHaveBeenCalledWith('PRAGMA locking_mode = exclusive;')
    expect(run).toHaveBeenCalledTimes(4)
    expect(expectedDatabase).toBe(mockDatabase)
  })

  it('should create values database with options', () => {
    const expectedDatabase = databaseService.createValuesDatabase('myDb.db', { wal: true, optimize: true, vacuum: true })
    expect(prepare).toHaveBeenCalledTimes(7)
    expect(prepare).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;')
    expect(prepare).toHaveBeenCalledWith('PRAGMA optimize;')
    expect(prepare).toHaveBeenCalledWith('PRAGMA vacuum;')
    expect(run).toHaveBeenCalledTimes(7)
    expect(expectedDatabase).toBe(mockDatabase)
  })

  it('should create value errors database', () => {
    const expectedDatabase = databaseService.createValueErrorsDatabase('myDb.db')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS cache ('
        + 'id INTEGER PRIMARY KEY, '
        + 'timestamp TEXT, '
        + 'data TEXT, '
        + 'point_id TEXT);')
    expect(run).toHaveBeenCalledTimes(1)
    expect(expectedDatabase).toBe(mockDatabase)
  })

  it('should create file database', () => {
    const expectedDatabase = databaseService.createFilesDatabase('myDb.db')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS cache ('
        + 'id INTEGER PRIMARY KEY, '
        + 'timestamp INTEGER, '
        + 'path TEXT);')
    expect(run).toHaveBeenCalledTimes(1)
    expect(expectedDatabase).toBe(mockDatabase)
  })

  it('should create config database', () => {
    const expectedDatabase = databaseService.createConfigDatabase('myDb.db')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS cache ('
        + 'id INTEGER PRIMARY KEY, '
        + 'name TEXT UNIQUE, '
        + 'value TEXT);')
    expect(run).toHaveBeenCalledTimes(1)
    expect(expectedDatabase).toBe(mockDatabase)
  })

  it('should save values', () => {
    databaseService.saveValues(mockDatabase, 'mySouthName', values)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('INSERT INTO cache (timestamp, data, point_id, south) VALUES '
        + '(\'2022-08-25T12:58:00.000Z\',\'%7B%22value%22:1,%22quality%22:192%7D\',\'point001\',\'mySouthName\'),'
        + '(\'2022-08-25T12:59:00.000Z\',\'%7B%22value%22:2,%22quality%22:192%7D\',\'point002\',\'mySouthName\');')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('should save error values', () => {
    const valuesToInsert = [
      { timestamp: '2022-08-25T12:58:00.000Z', data: { value: 1, quality: 192 }, pointId: 'point001' },
      { timestamp: '2022-08-25T12:59:00.000Z', data: { value: 2, quality: 192 }, pointId: 'point002' },
    ]
    databaseService.saveErroredValues(mockDatabase, valuesToInsert)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('INSERT INTO cache (timestamp, data, point_id) VALUES '
            + '(\'2022-08-25T12:58:00.000Z\',\'%7B%22value%22:1,%22quality%22:192%7D\',\'point001\'),'
            + '(\'2022-08-25T12:59:00.000Z\',\'%7B%22value%22:2,%22quality%22:192%7D\',\'point002\');')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('should get count', () => {
    const localGet = jest.fn()
    localGet.mockReturnValue({ count: 50 })
    mockDatabase.prepare.mockReturnValue({ get: localGet })
    databaseService.getCount(mockDatabase)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) AS count FROM cache')
    expect(localGet).toHaveBeenCalledTimes(1)
  })

  it('should get values to send', () => {
    const valuesToSend = databaseService.getValuesToSend(mockDatabase, 50)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT id, timestamp, data, point_id AS pointId, south as dataSourceId '
        + 'FROM cache '
        + 'ORDER BY timestamp '
        + 'LIMIT 50')

    expect(valuesToSend).toEqual(values)
  })

  it('should remove sent values', () => {
    const localRun = jest.fn()
    localRun.mockReturnValue({ changes: 2 })
    mockDatabase.prepare.mockReturnValue({ run: localRun })

    const result = databaseService.removeSentValues(mockDatabase, [{ id: 1 }, { id: 2 }])
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('DELETE FROM cache WHERE id IN (1,2)')

    expect(localRun).toHaveBeenCalledTimes(1)
    expect(result).toEqual(2)
  })

  it('should save file', () => {
    databaseService.saveFile(mockDatabase, 123, 'myFilePath')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('INSERT INTO cache (timestamp, path) VALUES (?, ?)')

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(123, 'myFilePath')
  })

  it('should get file to send', () => {
    const result = databaseService.getFileToSend(mockDatabase)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT path, timestamp '
        + 'FROM cache '
        + 'ORDER BY timestamp '
        + 'LIMIT 1')

    expect(all).toHaveBeenCalledTimes(1)
    expect(all).toHaveBeenCalledWith()
    expect(result).toEqual({ path: 'myFilePath', timestamp: 123 })
  })

  it('should return null if no file to send', () => {
    mockDatabase.prepare.mockReturnValue({ all: jest.fn(() => []) })

    const result = databaseService.getFileToSend(mockDatabase)

    expect(result).toEqual(null)
  })

  it('should delete sent file', () => {
    databaseService.deleteSentFile(mockDatabase, 'myFilePath')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('DELETE FROM cache WHERE path = ?')

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith('myFilePath')
  })

  it('should get file count', () => {
    const localGet = jest.fn()
    localGet.mockReturnValue({ count: 1 })
    mockDatabase.prepare.mockReturnValue({ get: localGet })

    const result = databaseService.getFileCount(mockDatabase, 'myFilePath')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) AS count FROM cache WHERE path = ?')

    expect(localGet).toHaveBeenCalledTimes(1)
    expect(localGet).toHaveBeenCalledWith('myFilePath')

    expect(result).toEqual(1)
  })

  it('should get file count for a North connector', () => {
    const localGet = jest.fn()
    localGet.mockReturnValue({ count: 11 })
    mockDatabase.prepare.mockReturnValue({ get: localGet })

    const result = databaseService.getFileCountForNorthConnector(mockDatabase)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) AS count FROM cache')

    expect(localGet).toHaveBeenCalledTimes(1)
    expect(localGet).toHaveBeenCalledWith()

    expect(result).toEqual(11)
  })

  it('should upsert config', () => {
    databaseService.upsertConfig(mockDatabase, 'configEntry', 'value')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('INSERT INTO cache (name, value) '
        + 'VALUES (?, ?) '
        + 'ON CONFLICT(name) DO UPDATE SET value = ?')

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith('configEntry', 'value', 'value')
  })

  it('should get config', () => {
    const localGet = jest.fn()
    localGet.mockReturnValue({ value: 'myConfigValue' })
    mockDatabase.prepare.mockReturnValue({ get: localGet })

    const result = databaseService.getConfig(mockDatabase, 'configEntry')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT value '
        + 'FROM cache '
        + 'WHERE name = ?')

    expect(localGet).toHaveBeenCalledTimes(1)
    expect(localGet).toHaveBeenCalledWith('configEntry')

    expect(result).toEqual('myConfigValue')
  })

  it('should get logs', () => {
    const retrievedLogs = [
      { timestamp: 123, message: 'myLogMessage1' },
      { timestamp: 124, message: 'myLogMessage2' },
    ]
    const localAll = jest.fn()
    localAll.mockReturnValue(retrievedLogs)
    mockDatabase.prepare.mockReturnValue({ all: localAll })

    const verbosity = ['error', 'warn']
    const result = databaseService.getLogs(
      'myDb.db',
      '2022-07-25T12:58:00.000Z',
      '2022-08-25T12:58:00.000Z',
      verbosity,
    )
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT * FROM logs '
        + 'WHERE timestamp BETWEEN ? AND ? '
        + `AND level IN (${verbosity.map((_) => '?')})`)

    expect(localAll).toHaveBeenCalledTimes(1)
    expect(localAll).toHaveBeenCalledWith(['2022-07-25T12:58:00.000Z', '2022-08-25T12:58:00.000Z', ...verbosity])

    expect(result).toEqual(retrievedLogs)
  })

  it('should get history query south data', () => {
    const retrievedData = { dataEntry: 123 }
    const localAll = jest.fn()
    localAll.mockReturnValue(retrievedData)
    mockDatabase.prepare.mockReturnValue({ all: localAll })

    const result = databaseService.getHistoryQuerySouthData('myDb.db')
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith('SELECT * FROM cache')

    expect(localAll).toHaveBeenCalledTimes(1)

    expect(result).toEqual(retrievedData)
  })
})
