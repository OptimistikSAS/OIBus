const fs = require('fs')
const OIAnalyticsFile = require('./OIAnalyticsFile.class')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.sendRequest = jest.fn()
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

// Mock the logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: () => jest.fn(),
    debug: () => jest.fn(),
    info: () => jest.fn(),
    error: () => jest.fn(),
    warn: () => jest.fn(),
  }
}))

describe('oi-analytics-file', () => {
  it('should call this.engine.sendRequest on each handleFile()', async () => {
    const oiAnalyticsFile = new OIAnalyticsFile(config.north.applications[2], engine)
    oiAnalyticsFile.connect()
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 1000 }))
    oiAnalyticsFile.handleFile('test')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(engine.sendRequest).toHaveBeenCalledWith(
      'https://demo.oianalytics.fr/api/optimistik/data/values/upload',
      'POST',
      { password: 'anypass', type: 'Basic', username: 'anyuser' },
      null,
      'test',
    )
  })
})
