import * as databaseService from './database.service.js'

const values = [
  { id: 1, timestamp: '2022-08-25T12:58:00.000Z', data: { value: 1, quality: 192 }, pointId: 'point001' },
  { id: 2, timestamp: '2022-08-25T12:59:00.000Z', data: { value: 2, quality: 192 }, pointId: 'point002' },
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
    id: value.id,
    timestamp: value.timestamp,
    pointId: value.pointId,
    data: encodeURI(JSON.stringify(value.data)),
  }))
  all = jest.fn().mockReturnValue(retrievedValues)
  get = jest.fn().mockReturnValue(retrievedValues)
  run = jest.fn()
  prepare = jest.fn()
  prepare.mockReturnValue({
    all,
    get,
    run,
    iterate,
  })
  mockDatabase = { prepare }
})

describe('Database service', () => {
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

  it('should get paginated logs', () => {
    const retrievedLogs = [
      { timestamp: 123, message: 'myLogMessage1' },
      { timestamp: 124, message: 'myLogMessage2' },
    ]
    const localAll = jest.fn()
    localAll.mockReturnValue(retrievedLogs)
    const localGet = jest.fn()
    localGet.mockReturnValue({ count: 2 })
    mockDatabase.prepare.mockReturnValue({ all: localAll, get: localGet })

    const verbosity = ['error', 'warn']
    const result = databaseService.getPaginatedLogs(
      'myDb.db',
      '2022-07-25T12:58:00.000Z',
      '2022-08-25T12:58:00.000Z',
      'myScope',
      'myTextContent',
      verbosity,
      'ASC',
    )
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare).toHaveBeenCalledWith('SELECT id, timestamp, level, scope, source, message FROM logs WHERE '
        + 'timestamp BETWEEN \'2022-07-25T12:58:00.000Z\' AND \'2022-08-25T12:58:00.000Z\' AND level IN (\'error\',\'warn\') '
        + 'AND scope like \'%myScope%\' AND message like \'%myTextContent%\' ORDER BY timestamp ASC LIMIT 50 OFFSET 0')
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM logs WHERE timestamp BETWEEN '
        + '\'2022-07-25T12:58:00.000Z\' AND \'2022-08-25T12:58:00.000Z\' AND level IN (\'error\',\'warn\') '
        + 'AND scope like \'%myScope%\' AND message like \'%myTextContent%\'')

    expect(localAll).toHaveBeenCalledTimes(1)
    expect(localGet).toHaveBeenCalledTimes(1)

    const expectedResult = {
      content: [{ message: 'myLogMessage1', timestamp: 123 }, { message: 'myLogMessage2', timestamp: 124 }],
      pageNumber: 0,
      pageSize: 2,
      totalNumberOfElements: 2,
      totalNumberOfPages: 1,
    }
    expect(result).toEqual(expectedResult)
  })

  it('should get paginated logs with page, without scope and text content', () => {
    const retrievedLogs = [
      { timestamp: 123, message: 'myLogMessage1' },
      { timestamp: 124, message: 'myLogMessage2' },
    ]
    const localAll = jest.fn()
    localAll.mockReturnValue(retrievedLogs)
    const localGet = jest.fn()
    localGet.mockReturnValue({ count: 2 })
    mockDatabase.prepare.mockReturnValue({ all: localAll, get: localGet })

    const verbosity = ['error', 'warn']
    const result = databaseService.getPaginatedLogs(
      'myDb.db',
      '2022-07-25T12:58:00.000Z',
      '2022-08-25T12:58:00.000Z',
      null,
      null,
      verbosity,
      'DESC',
      1,
    )
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare).toHaveBeenCalledWith('SELECT id, timestamp, level, scope, source, message FROM logs WHERE '
        + 'timestamp BETWEEN \'2022-07-25T12:58:00.000Z\' AND \'2022-08-25T12:58:00.000Z\' AND level IN (\'error\',\'warn\') '
        + 'ORDER BY timestamp DESC LIMIT 50 OFFSET 50')
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM logs WHERE timestamp BETWEEN '
        + '\'2022-07-25T12:58:00.000Z\' AND \'2022-08-25T12:58:00.000Z\' AND level IN (\'error\',\'warn\')')

    expect(localAll).toHaveBeenCalledTimes(1)
    expect(localGet).toHaveBeenCalledTimes(1)

    const expectedResult = {
      content: [{ message: 'myLogMessage1', timestamp: 123 }, { message: 'myLogMessage2', timestamp: 124 }],
      pageNumber: 1,
      pageSize: 2,
      totalNumberOfElements: 2,
      totalNumberOfPages: 1,
    }
    expect(result).toEqual(expectedResult)
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
