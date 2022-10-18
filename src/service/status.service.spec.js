const { PassThrough } = require('node:stream')
const StatusService = require('./status.service')

let statusService = null

describe('Status service', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    statusService = new StatusService()
  })

  it('should activate stream on data event', () => {
    const write = jest.fn()
    statusService.stream = { write }

    statusService.listener({ data: 'myData' })

    expect(write).toHaveBeenCalledWith(`data: ${JSON.stringify({ data: 'myData' })}\n\n`)
  })

  it('should emit updated data', () => {
    statusService.eventEmitter.emit = jest.fn()
    statusService.updateStatusDataStream({ updatedField: 'updatedValue' })

    expect(statusService.eventEmitter.emit).toHaveBeenCalledWith('data', { updatedField: 'updatedValue' })

    statusService.updateStatusDataStream({ anotherField: 'anotherValue' })
    expect(statusService.eventEmitter.emit).toHaveBeenCalledWith(
      'data',
      { updatedField: 'updatedValue', anotherField: 'anotherValue' },
    )
  })

  it('should force data update', () => {
    statusService.eventEmitter.emit = jest.fn()
    statusService.forceDataUpdate()
    expect(statusService.eventEmitter.emit).toHaveBeenCalledWith(
      'data',
      { },
    )

    statusService.statusData = { aField: 'aValue' }
    statusService.forceDataUpdate()
    expect(statusService.eventEmitter.emit).toHaveBeenCalledWith(
      'data',
      { aField: 'aValue' },
    )
  })

  it('should getStatus', () => {
    statusService.statusData = { aField: 'aValue' }
    const status = statusService.getStatus()
    expect(status).toEqual({ aField: 'aValue' })
  })

  it('should stop', () => {
    statusService.eventEmitter.removeAllListeners = jest.fn()
    statusService.stop()
    expect(statusService.eventEmitter.removeAllListeners).toHaveBeenCalledTimes(1)
    const destroy = jest.fn()
    statusService.stream = { destroy }
    statusService.stop()

    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('should destroy and get data stream', () => {
    const destroy = jest.fn()
    statusService.stream = { destroy }
    const expectedStream = statusService.getDataStream()
    expect(expectedStream).toBeInstanceOf(PassThrough)

    expect(destroy).toHaveBeenCalledTimes(1)

    destroy.mockClear()
    statusService.stream = undefined
    const anotherExpectedStream = statusService.getDataStream()
    expect(anotherExpectedStream).toBeInstanceOf(PassThrough)
    expect(destroy).toHaveBeenCalledTimes(0)
  })

  it('should destroy and get data stream', () => {
    const destroy = jest.fn()
    statusService.stream = { destroy }
    const expectedStream = statusService.getDataStream()
    expect(expectedStream).toBeInstanceOf(PassThrough)

    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
