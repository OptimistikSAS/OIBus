const ValueCache = require('./ValueCache.class')
const databaseService = require('../../services/database.service')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

jest.mock('../../services/database.service')

let cache = null
describe('ValueCache', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    cache = new ValueCache('northId', logger, 'myCacheFolder', true, 1000)
  })

  it('should be properly initialized with values in cache', async () => {
    cache.refreshArchiveFolder = jest.fn()
    databaseService.getCount.mockReturnValue(2)
    await cache.init()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')

    expect(logger.debug).toHaveBeenCalledWith('2 values in cache.')
    expect(logger.warn).toHaveBeenCalledWith('2 values in error cache.')
  })

  it('should be properly initialized with no value in cache', async () => {
    cache.refreshArchiveFolder = jest.fn()
    databaseService.getCount.mockReturnValue(0)
    await cache.init()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')

    expect(logger.debug).toHaveBeenCalledWith('No values in cache.')
    expect(logger.debug).toHaveBeenCalledWith('No error values in cache.')
  })

  it('should properly stop', () => {
    const valueDatabase = { close: jest.fn() }
    cache.valuesDatabase = valueDatabase
    const valuesErrorDatabase = { close: jest.fn() }
    cache.valuesErrorDatabase = valuesErrorDatabase
    cache.stop()
    expect(valueDatabase.close).toHaveBeenCalledTimes(1)
    expect(valuesErrorDatabase.close).toHaveBeenCalledTimes(1)
  })

  it('should properly cache values', () => {
    cache.valuesDatabase = 'myDatabase'
    cache.cacheValues('southId', [{ value: 'myValue' }])

    expect(databaseService.saveValues).toHaveBeenCalledWith('myDatabase', 'southId', [{ value: 'myValue' }])
  })

  it('should properly retrieve values from cache', () => {
    databaseService.getValuesToSend.mockImplementation(() => [{ value: 'value1' }, { value: 'value2' }])
    cache.valuesDatabase = 'myDatabase'
    const cacheValues = cache.retrieveValuesFromCache(2)
    expect(databaseService.getValuesToSend).toHaveBeenCalledWith('myDatabase', 2)
    expect(cacheValues).toEqual([{ value: 'value1' }, { value: 'value2' }])
  })

  it('should properly remove values from cache', () => {
    databaseService.removeSentValues.mockImplementation(() => 2)
    cache.valuesDatabase = 'myDatabase'
    cache.removeValuesFromCache([{ value: 'valueToRemove' }])
    expect(databaseService.removeSentValues).toHaveBeenCalledWith('myDatabase', [{ value: 'valueToRemove' }])
    expect(logger.debug).toHaveBeenCalledWith('2 values removed from cache.')
  })

  it('should properly manage errored values', () => {
    databaseService.removeSentValues.mockImplementation(() => 2)
    cache.valuesErrorDatabase = 'myErrorDatabase'
    cache.valuesDatabase = 'myDatabase'
    cache.manageErroredValues([{ value: 'valueToRemove' }])
    expect(databaseService.saveErroredValues).toHaveBeenCalledWith('myErrorDatabase', [{ value: 'valueToRemove' }])
    expect(databaseService.removeSentValues).toHaveBeenCalledWith('myDatabase', [{ value: 'valueToRemove' }])
    expect(logger.error).toHaveBeenCalledWith('2 values removed from cache and saved to values error database.')
  })

  it('should get number of values in cache', () => {
    databaseService.getCount.mockImplementation(() => 2)
    cache.valuesDatabase = 'myDatabase'

    const count = cache.getNumberOfValues()
    expect(count).toEqual(2)
    expect(databaseService.getCount).toHaveBeenCalledWith('myDatabase')
  })

  it('should check if cache is empty', () => {
    databaseService.getCount.mockImplementationOnce(() => 0).mockImplementation(() => 2)
    const empty = cache.isEmpty()
    expect(empty).toBeTruthy()
    const notEmpty = cache.isEmpty()
    expect(notEmpty).toBeFalsy()
  })
})
