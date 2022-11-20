const path = require('node:path')
const fs = require('node:fs/promises')

const nanoid = require('nanoid')

const ValueCache = require('./value-cache.service')

const { createFolder, filesExists } = require('../utils')

jest.mock('node:fs/promises')
jest.mock('../utils')

// mocking the nanoid method
jest.mock('nanoid')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}
const northSendValuesCallback = jest.fn()
const northShouldRetryCallback = jest.fn()
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
const nowDateString = '2020-02-02T02:02:02.222Z'
let settings
let cache
describe('ValueCache', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
    settings = { sendInterval: 1000, groupCount: 1000, maxSendCount: 10000, retryCount: 3, retryInterval: 5000 }
    cache = new ValueCache(
      'northId',
      logger,
      'myCacheFolder',
      northSendValuesCallback,
      northShouldRetryCallback,
      settings,
    )
  })

  afterEach(async () => {
    await flushPromises()
  })

  it('should be properly initialized with values in cache', async () => {
    filesExists.mockImplementation(() => true)
    cache.resetValuesTimeout = jest.fn()
    fs.readdir.mockImplementation(() => ([
      'buffer.tmp',
      '1.queue.tmp',
      '2.queue.tmp',
      '1.compact.tmp',
      '2.compact.tmp',
    ]))

    fs.readFile.mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstQueueValue1' }, { data: 'myFirstQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondQueueValue1' }, { data: 'mySecondQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondCompactValue1' }, { data: 'mySecondCompactValue2' }]))
    fs.stat.mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }))
    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')

    expect(createFolder).toHaveBeenCalledTimes(2)
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'))

    expect(logger.info).toHaveBeenCalledWith('8 values in cache.')
    expect(cache.resetValuesTimeout).toHaveBeenCalledTimes(1)
  })

  it('should be properly initialized with values in cache and no buffer file', async () => {
    filesExists.mockImplementation(() => false)
    cache.resetValuesTimeout = jest.fn()
    fs.readdir.mockImplementation(() => ([
      'buffer.tmp',
      '1.queue.tmp',
      '2.queue.tmp',
      '1.compact.tmp',
      '2.compact.tmp',
    ]))

    fs.readFile.mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstQueueValue1' }, { data: 'myFirstQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondQueueValue1' }, { data: 'mySecondQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondCompactValue1' }, { data: 'mySecondCompactValue2' }]))
    fs.stat.mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }))
    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')

    expect(createFolder).toHaveBeenCalledTimes(2)
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'))

    expect(logger.info).toHaveBeenCalledWith('8 values in cache.')
    expect(cache.resetValuesTimeout).toHaveBeenCalledTimes(1)
  })

  it('should be properly initialized with no value in cache', async () => {
    filesExists.mockImplementation(() => true)
    fs.readdir.mockImplementation(() => ([
      'buffer.tmp',
      '0.queue.tmp',
      '0.compact.tmp',
    ]))
    fs.readFile.mockImplementationOnce(() => {
      throw new Error('buffer read file error')
    })
      .mockImplementationOnce(() => {
        throw new Error('queue read file error')
      })

    fs.stat.mockImplementationOnce(() => {
      throw new Error('compact stat file error')
    })

    cache.settings.sendInterval = 0
    await cache.start()

    expect(logger.error).toHaveBeenCalledWith(new Error('buffer read file error'))
    expect(logger.error).toHaveBeenCalledWith(`Error while reading queue file "${path.resolve(cache.valueFolder, '0.queue.tmp')}"`
        + `: ${new Error('queue read file error')}`)
    expect(logger.error).toHaveBeenCalledWith(`Error while reading queue file "${path.resolve(cache.valueFolder, '0.compact.tmp')}"`
        + `: ${new Error('compact stat file error')}`)
    expect(logger.info).toHaveBeenCalledWith('No value in cache.')
    expect(logger.warn).toHaveBeenCalledWith('No send interval. No values will be sent.')
  })

  it('should properly flush the data with time-flush', async () => {
    cache.flushBuffer = [{
      timestamp: '2020-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 666.666,
        quality: true,
      },
    },
    {
      timestamp: '2021-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 777.777,
        quality: true,
      },
    }]
    cache.bufferTimeout = 1

    cache.compactQueueCache = jest.fn()
    cache.sendValuesWrapper = jest.fn()
    nanoid.nanoid.mockReturnValue('generated-uuid')

    await cache.flush()
    expect(logger.trace).toHaveBeenCalledWith('Flush 2 values (time-flush).')
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(cache.valueFolder, 'buffer.tmp'),
      path.resolve(cache.valueFolder, 'generated-uuid.queue.tmp'),
    )
    expect(cache.compactQueueCache).not.toHaveBeenCalled()
    expect(cache.sendValuesWrapper).not.toHaveBeenCalled()
    expect(cache.bufferTimeout).toBeNull()
  })

  it('should properly flush with no data to flush', async () => {
    cache.flushBuffer = []
    cache.bufferTimeout = 1

    cache.compactQueueCache = jest.fn()
    cache.sendValuesWrapper = jest.fn()
    nanoid.nanoid.mockReturnValue('generated-uuid')

    await cache.flush()
    expect(logger.trace).toHaveBeenCalledWith('Nothing to flush (time-flush).')
    expect(fs.rename).not.toHaveBeenCalled()
    expect(cache.compactQueueCache).not.toHaveBeenCalled()
    expect(cache.sendValuesWrapper).not.toHaveBeenCalled()
    expect(cache.bufferTimeout).toBeNull()
  })

  it('should properly flush the data with max-flush and group count', async () => {
    cache.flushBuffer = [{
      timestamp: '2020-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 666.666,
        quality: true,
      },
    },
    {
      timestamp: '2021-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 777.777,
        quality: true,
      },
    }]
    cache.settings.groupCount = 2
    cache.bufferTimeout = 1

    cache.compactQueueCache = jest.fn()
    cache.sendValuesWrapper = jest.fn()
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    nanoid.nanoid.mockReturnValue('generated-uuid')

    await cache.flush('max-flush')
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(logger.trace).toHaveBeenCalledWith('Flush 2 values (max-flush).')
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(cache.valueFolder, 'buffer.tmp'),
      path.resolve(cache.valueFolder, 'generated-uuid.queue.tmp'),
    )
    expect(cache.compactQueueCache).not.toHaveBeenCalled()
    expect(cache.sendValuesWrapper).toHaveBeenCalledWith('group-count')
    expect(cache.bufferTimeout).toBeNull()
  })

  it('should properly flush the data with max-flush and max group count', async () => {
    const values = [{
      timestamp: '2020-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 666.666,
        quality: true,
      },
    },
    {
      timestamp: '2021-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 777.777,
        quality: true,
      },
    }]
    cache.flushBuffer = values
    cache.settings.maxSendCount = 2
    cache.bufferTimeout = 1
    cache.compactQueueCache = jest.fn()
    cache.sendValuesWrapper = jest.fn()
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    nanoid.nanoid.mockReturnValue('generated-uuid')

    await cache.flush('max-flush')
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(logger.trace).toHaveBeenCalledWith('Flush 2 values (max-flush).')
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(cache.valueFolder, 'buffer.tmp'),
      path.resolve(cache.valueFolder, 'generated-uuid.queue.tmp'),
    )
    const expectedQueue = new Map()
    expectedQueue.set('generated-uuid.queue.tmp', values)
    expect(cache.compactQueueCache).toHaveBeenCalledWith(expectedQueue)
    expect(cache.sendValuesWrapper).not.toHaveBeenCalled()
    expect(cache.bufferTimeout).toBeNull()
  })

  it('should properly reset values timeout', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    cache.sendValuesWrapper = jest.fn()

    cache.resetValuesTimeout(1000)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(cache.sendValuesWrapper).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(cache.sendValuesWrapper).toHaveBeenCalledTimes(1)
  })

  it('should properly stop', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await cache.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(logger.debug).not.toHaveBeenCalled()

    cache.sendingValues$ = { promise: jest.fn() }
    clearTimeoutSpy.mockClear()
    await cache.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(logger.debug).toHaveBeenCalledWith('Waiting for connector to finish sending values...')
  })

  it('should check if cache is empty', async () => {
    fs.readdir.mockImplementationOnce(() => []).mockImplementationOnce(() => [{}]).mockImplementationOnce(() => {
      throw new Error('readdir error')
    })
    const empty = await cache.isEmpty()
    expect(empty).toBeTruthy()
    expect(fs.readdir).toHaveBeenCalledWith(cache.valueFolder)
    const notEmpty = await cache.isEmpty()
    expect(notEmpty).toBeFalsy()
    expect(fs.readdir).toHaveBeenCalledWith(cache.valueFolder)
    const notEmptyBecauseOfError = await cache.isEmpty()
    expect(notEmptyBecauseOfError).toBeTruthy()
    expect(fs.readdir).toHaveBeenCalledWith(cache.valueFolder)
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
  })

  it('should catch error of sendValuesWrapper', async () => {
    cache.sendValues = jest.fn()
    await cache.sendValuesWrapper()

    expect(cache.sendValues).toHaveBeenCalledWith('timer')
    expect(logger.error).not.toHaveBeenCalled()

    cache.sendValues.mockImplementation(() => {
      throw new Error('send values error')
    })
    await cache.sendValuesWrapper('group-count')
    expect(cache.sendValues).toHaveBeenCalledWith('group-count')

    expect(logger.error).toHaveBeenCalledWith(new Error('send values error'))
  })

  it('should remove sent values', async () => {
    const valuesToRemove = [{ key: '1.queue.tmp' }, { key: '1.compact.tmp' }]
    cache.deleteKeyFromCache = jest.fn()
    await cache.removeSentValues(valuesToRemove)

    expect(cache.deleteKeyFromCache).toHaveBeenCalledTimes(2)
    expect(cache.deleteKeyFromCache).toHaveBeenCalledWith('1.queue.tmp')
    expect(cache.deleteKeyFromCache).toHaveBeenCalledWith('1.compact.tmp')
  })

  it('should delete key from cache', async () => {
    cache.compactedQueue = [{ fileName: '1.compact.tmp' }]
    cache.queue = new Map()
    cache.queue.set('1.queue.tmp', [])
    cache.queue.set('2.queue.tmp', [])
    fs.unlink.mockImplementationOnce(() => '').mockImplementation(() => {
      throw new Error('unlink error')
    })

    await cache.deleteKeyFromCache('1.queue.tmp')
    expect(cache.compactedQueue).toEqual([{ fileName: '1.compact.tmp' }])
    const expectedMap = new Map()
    expectedMap.set('2.queue.tmp', [])
    expect(cache.queue).toEqual(expectedMap)
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve(cache.valueFolder, '1.queue.tmp')}" from cache.`)
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(cache.valueFolder, '1.queue.tmp'))

    await cache.deleteKeyFromCache('1.compact.tmp')
    expect(cache.compactedQueue).toEqual([])
    expect(cache.queue).toEqual(expectedMap)
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve(cache.valueFolder, '1.compact.tmp')}" from cache.`)
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(cache.valueFolder, '1.compact.tmp'))
    expect(logger.error).toHaveBeenCalledWith('Error while removing file '
        + `"${path.resolve(cache.valueFolder, '1.compact.tmp')}" from cache: ${new Error('unlink error')}`)
  })

  it('should manage error values', async () => {
    const valuesToRemove = [{ key: '1.queue.tmp' }, { key: '1.compact.tmp' }]
    cache.compactedQueue = [{ fileName: '1.compact.tmp' }]
    cache.queue = new Map()
    cache.queue.set('1.queue.tmp', [])
    cache.queue.set('2.queue.tmp', [])
    fs.rename.mockImplementationOnce(() => '').mockImplementation(() => {
      throw new Error('unlink error')
    })

    await cache.manageErroredValues(valuesToRemove)
    expect(cache.compactedQueue).toEqual([])
    const expectedMap = new Map()
    expectedMap.set('2.queue.tmp', [])
    expect(cache.queue).toEqual(expectedMap)
    expect(logger.trace).toHaveBeenCalledWith(`Moving "${path.resolve(cache.valueFolder, '1.queue.tmp')}" `
        + `to error cache: "${path.resolve(cache.errorFolder, '1.queue.tmp')}".`)
    expect(fs.rename).toHaveBeenCalledWith(path.resolve(cache.valueFolder, '1.queue.tmp'), path.resolve(cache.errorFolder, '1.queue.tmp'))
    expect(cache.queue).toEqual(expectedMap)
    expect(logger.trace).toHaveBeenCalledWith(`Moving "${path.resolve(cache.valueFolder, '1.compact.tmp')}" `
        + `to error cache: "${path.resolve(cache.errorFolder, '1.compact.tmp')}".`)
    expect(fs.rename).toHaveBeenCalledWith(path.resolve(cache.valueFolder, '1.compact.tmp'), path.resolve(cache.errorFolder, '1.compact.tmp'))
    expect(logger.error).toHaveBeenCalledWith(`Error while moving file "${path.resolve(cache.valueFolder, '1.compact.tmp')}" `
        + `into cache error "${path.resolve(cache.errorFolder, '1.compact.tmp')}": ${new Error('unlink error')}`)
  })

  it('should get values to send', async () => {
    cache.compactedQueue = []
    cache.queue = new Map()
    cache.queue.set('1.queue.tmp', [{ data: 'valueInQueue1' }])
    cache.queue.set('2.queue.tmp', [{ data: 'valueInQueue2' }])
    const valuesFromQueue = await cache.getValuesToSend()
    expect(valuesFromQueue).toEqual([
      { key: '1.queue.tmp', values: [{ data: 'valueInQueue1' }] },
      { key: '2.queue.tmp', values: [{ data: 'valueInQueue2' }] },
    ])

    cache.compactedQueue = [{ fileName: '1.compact.tmp' }]
    fs.readFile.mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => {
        throw new Error('readFile error')
      })

    const valuesFromCompact = await cache.getValuesToSend()
    expect(valuesFromCompact).toEqual([{ key: '1.compact.tmp', values: [{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }] }])
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(cache.valueFolder, '1.compact.tmp'), { encoding: 'utf8' })

    const errorValues = await cache.getValuesToSend()
    expect(errorValues).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(`Error while reading compacted file "1.compact.tmp": ${new Error('readFile error')}`)
  })

  it('should not retrieve values if already sending it', async () => {
    cache.sendingValuesInProgress = true
    await cache.sendValues('timer')

    expect(logger.trace).toHaveBeenCalledWith('Sending values (timer).')
    expect(logger.trace).toHaveBeenCalledWith('Already sending values...')
    expect(cache.sendNextImmediately).toBeFalsy()

    await cache.sendValues('group-count')

    expect(logger.trace).toHaveBeenCalledWith('Sending values (group-count).')
    expect(logger.trace).toHaveBeenCalledWith('Already sending values...')
    expect(cache.sendNextImmediately).toBeTruthy()
  })

  it('should not send values if no values to send', async () => {
    cache.getValuesToSend = jest.fn(() => [])
    cache.resetValuesTimeout = jest.fn()
    await cache.sendValues()
    expect(cache.getValuesToSend).toHaveBeenCalledTimes(1)
    expect(logger.trace).toHaveBeenCalledWith('No value to send...')
    expect(cache.valuesBeingSent).toBeNull()
    expect(cache.resetValuesTimeout).toHaveBeenCalledTimes(1)
  })

  it('should successfully send values', async () => {
    const valuesToSend = [{ key: '1.queue.tmp', values: [{ value: 'myFirstValue' }, { value: 'mySecondValue' }] },
      { key: '2.queue.tmp', values: [{ value: 'myThirdValue' }] }]
    cache.getValuesToSend = jest.fn().mockImplementationOnce(() => valuesToSend).mockImplementationOnce(() => [])
    cache.northSendValuesCallback = jest.fn()
    cache.removeSentValues = jest.fn()
    await cache.sendValues('timer')

    expect(cache.northSendValuesCallback).toHaveBeenCalledTimes(1)
    expect(cache.northSendValuesCallback).toHaveBeenCalledWith([{ value: 'myFirstValue' }, { value: 'mySecondValue' }, { value: 'myThirdValue' }])
    expect(cache.removeSentValues).toHaveBeenCalledTimes(1)
    expect(cache.removeSentValues).toHaveBeenCalledWith(valuesToSend)
    expect(cache.valuesRetryCount).toEqual(0)
    expect(cache.valuesBeingSent).toBeNull()

    expect(logger.trace).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(settings.sendInterval / 2)
    expect(logger.trace).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(settings.sendInterval / 2)
    await flushPromises()
    expect(logger.trace).toHaveBeenCalledTimes(3)
    expect(logger.trace).toHaveBeenCalledWith('No value to send...')
  })

  it('should send values immediately', async () => {
    const valuesToSend = [{ key: '1.queue.tmp', values: [{ value: 'myFirstValue' }, { value: 'mySecondValue' }] },
      { key: '2.queue.tmp', values: [{ value: 'myThirdValue' }] }]
    cache.getValuesToSend = jest.fn().mockImplementationOnce(() => valuesToSend).mockImplementationOnce(() => valuesToSend)
    cache.removeSentValues = jest.fn()
    // handle values takes twice the sending interval time
    const promiseToResolve = new Promise((resolve) => {
      setTimeout(() => resolve(), settings.sendInterval * 2)
    })
    cache.northSendValuesCallback = jest.fn(() => promiseToResolve)
    cache.resetValuesTimeout = jest.fn()

    cache.sendValues('timer')
    expect(logger.trace).toHaveBeenCalledWith('Sending values (timer).')
    jest.advanceTimersByTime(settings.sendInterval)
    expect(cache.sendNextImmediately).toBeFalsy()
    // Provoke an immediate sending request for next tick
    cache.sendValues('group-count')
    expect(logger.trace).toHaveBeenCalledWith('Sending values (group-count).')

    expect(cache.sendNextImmediately).toBeTruthy()

    jest.advanceTimersByTime(settings.sendInterval)
    await flushPromises()

    expect(cache.northSendValuesCallback).toHaveBeenCalledTimes(1)
    expect(cache.northSendValuesCallback).toHaveBeenCalledWith([{ value: 'myFirstValue' }, { value: 'mySecondValue' }, { value: 'myThirdValue' }])
    expect(cache.resetValuesTimeout).toHaveBeenCalledWith(100)

    await flushPromises()
  })

  it('should retry to send values if it fails', async () => {
    const valuesToSend = [{ key: '1.queue.tmp', values: [{ value: 'myFirstValue' }, { value: 'mySecondValue' }] },
      { key: '2.queue.tmp', values: [{ value: 'myThirdValue' }] }]
    cache.getValuesToSend = jest.fn().mockImplementationOnce(() => valuesToSend).mockImplementationOnce(() => [])
    cache.manageErroredValues = jest.fn()
    cache.northSendValuesCallback = jest.fn()
      .mockImplementationOnce(() => {
        throw new Error('handleValues error 0')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleValues error 1')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleValues error 2')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleValues error 3')
      })
    await cache.sendValues()
    expect(logger.debug).toHaveBeenCalledWith('Retrying values in 5000 ms. Retry count: 1')
    jest.advanceTimersByTime(settings.retryInterval)
    expect(logger.debug).toHaveBeenCalledWith('Retrying values in 5000 ms. Retry count: 2')
    jest.advanceTimersByTime(settings.retryInterval)
    expect(logger.debug).toHaveBeenCalledWith('Retrying values in 5000 ms. Retry count: 3')
    jest.advanceTimersByTime(settings.retryInterval)

    expect(cache.northSendValuesCallback).toHaveBeenCalledWith([{ value: 'myFirstValue' }, { value: 'mySecondValue' }, { value: 'myThirdValue' }])
    expect(cache.northSendValuesCallback).toHaveBeenCalledTimes(4)
    expect(cache.manageErroredValues).toHaveBeenCalledTimes(1)
    expect(logger.debug).toHaveBeenCalledWith('Too many retries. The values won\'t be sent again.')
    expect(cache.manageErroredValues).toHaveBeenCalledWith(valuesToSend)
  })

  it('should cache values and flush because of timer', async () => {
    const valuesToCache = [{ data: 'myFirstValue' }, { data: 'mySecondValue' }]
    cache.flush = jest.fn()
    await cache.cacheValues(valuesToCache)
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(cache.valueFolder, 'buffer.tmp'),
      JSON.stringify(valuesToCache),
      { encoding: 'utf8' },
    )
    expect(cache.flushBuffer).toEqual(valuesToCache)
    jest.advanceTimersByTime(150)
    await cache.cacheValues(valuesToCache)
    expect(cache.flush).not.toHaveBeenCalled()
    expect(cache.flushBuffer).toEqual([...valuesToCache, ...valuesToCache])

    jest.advanceTimersByTime(150)
    expect(cache.flush).toHaveBeenCalledWith()
  })

  it('should cache values and flush because of buffer max', async () => {
    const valuesToCache = []
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({})
    }
    cache.flush = jest.fn()
    await cache.cacheValues(valuesToCache)
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(cache.valueFolder, 'buffer.tmp'),
      JSON.stringify(valuesToCache),
      { encoding: 'utf8' },
    )
    jest.advanceTimersByTime(300)
    expect(cache.flush).toHaveBeenCalledWith('max-flush')
  })

  it('should compact queue', async () => {
    const queue = new Map()
    queue.set('1.queue.tmp', [{ data: 'myFirstValue' }, { data: 'mySecondValue' }])
    queue.set('2.queue.tmp', [{ data: 'myThirdValue' }])

    cache.deleteKeyFromCache = jest.fn()

    nanoid.nanoid.mockReturnValue('generated-uuid')

    await cache.compactQueueCache(queue)
    expect(logger.trace).toHaveBeenCalledWith('Max group count reach. Compacting queue into "generated-uuid.compact.tmp".')
    expect(cache.deleteKeyFromCache).toHaveBeenCalledTimes(2)
    expect(cache.compactedQueue).toEqual([{
      fileName: 'generated-uuid.compact.tmp',
      createdAt: new Date(nowDateString).getTime(),
      numberOfValues: 3,
    }])
  })

  it('should log an error and not remove file from queue if compact write error', async () => {
    const queue = new Map()
    cache.deleteKeyFromCache = jest.fn()
    fs.writeFile.mockImplementationOnce(() => {
      throw new Error('writing error')
    })
    await cache.compactQueueCache(queue)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(new Error('writing error'))
  })
})
