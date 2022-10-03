jest.mock('sprintf-js', () => ({ vsprintf: jest.fn() }))

const utils = require('./utils')

const nowDateString = '2020-02-02T02:02:02.222Z'

describe('South connector MQTT utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
  })

  it('should format value with payload pointId and iso timestamp', () => {
    const data = {
      myPointIdPath: 'pointId',
      myTimestampPath: new Date().toISOString(),
      myValuePath: 123,
      myQualityPath: 192,
    }
    const topic = '/myTopic'
    const formatOptions = {
      timestampPath: 'myTimestampPath',
      timestampOrigin: 'payload',
      timestampFormat: '',
      timezone: '',
      valuePath: 'myValuePath',
      pointIdPath: 'myPointIdPath',
      qualityPath: 'myQualityPath',
    }
    const pointsList = []
    const formattedValue = utils.formatValue(data, topic, formatOptions, pointsList)

    const expectedValue = { data: { quality: 192, value: 123 }, pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z' }
    expect(formattedValue).toEqual(expectedValue)
  })

  it('should format value with non-iso timestamp', () => {
    const data = {
      myTimestampPath: '2/2/2020, 2:02:02 AM',
      myValuePath: 123,
      myQualityPath: 192,
      myPointIdPath: 'myPointId',
    }
    const topic = '/myTopic'
    const formatOptions = {
      timestampPath: 'myTimestampPath',
      timestampOrigin: 'payload',
      timestampFormat: 'M/d/yyyy, h:mm:ss a',
      timezone: 'Europe/Paris',
      valuePath: 'myValuePath',
      qualityPath: 'myQualityPath',
      pointIdPath: 'myPointIdPath',
    }
    const pointsList = []
    const formattedValue = utils.formatValue(data, topic, formatOptions, pointsList)

    const expectedValue = { data: { quality: 192, value: 123 }, pointId: 'myPointId', timestamp: '2020-02-02T01:02:02.000Z' }
    expect(formattedValue).toEqual(expectedValue)
  })

  it('should catch point ID error', () => {
    const data = {}
    const topic = 'myTopic'
    const formatOptions = {
      timestampPath: 'myTimestampPath',
      timestampOrigin: 'myTimestampOrigin',
      timestampFormat: 'myTimestampFormat',
      timezone: 'myTimezone',
      valuePath: 'myValuePath',
      pointIdPath: 'myPointIdPath',
      qualityPath: 'myQualityPath',
    }
    const pointsList = [{ myOtherPointIdPath: 'wrong pointId' }]
    let formatError
    try {
      utils.formatValue(data, topic, formatOptions, pointsList)
    } catch (error) {
      formatError = error
    }
    expect(formatError).toEqual(new Error(`Could node find pointId in path "myPointIdPath" for data: ${JSON.stringify(data)}`))
  })
})
