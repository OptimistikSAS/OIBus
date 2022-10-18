const http = require('node:http')
const https = require('node:https')
const Stream = require('node:stream')

const csv = require('papaparse')

const utils = require('./utils')

jest.mock('papaparse', () => ({ unparse: jest.fn() }))
jest.mock('node:http', () => ({ request: jest.fn() }))
jest.mock('node:https', () => ({ request: jest.fn() }))

const nowDateString = '2020-02-02T02:02:02.222Z'

describe('South connector Rest API utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
  })

  it('should call csv unparse', () => {
    const entryList = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]

    utils.generateCSV(entryList, ';')

    expect(csv.unparse).toHaveBeenCalledWith(entryList, { header: true, delimiter: ';' })
  })

  it('should correctly return void string when there is no query params', () => {
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    const result = utils.formatQueryParams(startTime, endTime, [], 'ISO')
    expect(result).toEqual('')
  })

  it('should correctly format query params with ISO date string', () => {
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')
    const queryParams = [
      { queryParamKey: 'start', queryParamValue: '@StartTime' },
      { queryParamKey: 'end', queryParamValue: '@EndTime' },
      { queryParamKey: 'anotherParam', queryParamValue: 'anotherQueryParam' },
    ]

    const result = utils.formatQueryParams(startTime, endTime, queryParams, 'ISO')
    expect(result).toEqual('?start=2020-01-01T00%3A00%3A00.000Z&end=2021-01-01T00%3A00%3A00.000Z&'
        + 'anotherParam=anotherQueryParam')
  })

  it('should correctly format query params with Date number', () => {
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')
    const queryParams = [
      { queryParamKey: 'start', queryParamValue: '@StartTime' },
      { queryParamKey: 'end', queryParamValue: '@EndTime' },
      { queryParamKey: 'anotherParam', queryParamValue: 'anotherQueryParam' },
    ]

    const result = utils.formatQueryParams(startTime, endTime, queryParams, 'number')
    expect(result).toEqual('?start=1577836800000&end=1609459200000&'
        + 'anotherParam=anotherQueryParam')
  })

  it('should correctly create a body with GET HTTP', async () => {
    const streamStream = new Stream()
    const onMock = jest.fn()
    const writeMock = jest.fn()
    const endMock = jest.fn()
    http.request.mockImplementation((options, callback) => {
      callback(streamStream)
      streamStream.emit('data', '{ "data": "myValue" }')
      streamStream.emit('end') // this will trigger the promise resolve

      return {
        on: onMock,
        write: writeMock,
        end: endMock,
      }
    })
    const expectedResult = { data: 'myValue' }
    const result = await utils.httpGetWithBody('body', { protocol: 'http:' })
    expect(result).toEqual(expectedResult)
    expect(onMock).toHaveBeenCalledTimes(1)
    expect(writeMock).toHaveBeenCalledTimes(1)
    expect(writeMock).toHaveBeenCalledWith('body')
    expect(endMock).toHaveBeenCalledTimes(1)
  })

  it('should correctly create a body with GET HTTPS', async () => {
    const streamStream = new Stream()
    const onMock = jest.fn()
    const writeMock = jest.fn()
    const endMock = jest.fn()
    https.request.mockImplementation((options, callback) => {
      callback(streamStream)
      streamStream.emit('data', '{ "data": "myValue" }')
      streamStream.emit('end') // this will trigger the promise resolve

      return {
        on: onMock,
        write: writeMock,
        end: endMock,
      }
    })
    const expectedResult = { data: 'myValue' }
    const result = await utils.httpGetWithBody('body', { protocol: 'https:' })
    expect(result).toEqual(expectedResult)
    expect(onMock).toHaveBeenCalledTimes(1)
    expect(writeMock).toHaveBeenCalledTimes(1)
    expect(writeMock).toHaveBeenCalledWith('body')
    expect(endMock).toHaveBeenCalledTimes(1)
  })

  it('should throw an error when parsing received data', async () => {
    const streamStream = new Stream()
    https.request.mockImplementation((options, callback) => {
      callback(streamStream)
      streamStream.emit('data', 'some data')
      streamStream.emit('data', 'but not a')
      streamStream.emit('data', 'json')
      streamStream.emit('end') // this will trigger the promise resolve
      return {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      }
    })
    await expect(utils.httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrowError('Unexpected token s in JSON at position 0')
  })

  it('should call raw parser', () => {
    const expectedResults = { httpResults: [{ someData: 'someValue' }], latestDateRetrieved: nowDateString }
    // eslint-disable-next-line new-cap
    const results = utils.parsers.Raw([{ someData: 'someValue' }])
    expect(results).toEqual(expectedResults)
  })
})
