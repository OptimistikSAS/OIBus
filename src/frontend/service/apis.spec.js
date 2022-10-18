import apis from './apis'
import { testConfig } from '../../../tests/test-config'

const logSample = {
  id: 12852,
  level: 'debug',
  message: 'Getting South protocols',
  source: 'Engine',
  timestamp: '2020-01-01T00:00:00.000Z',
}

global.fetch = jest.fn().mockImplementation((uri) => {
  let jsonString
  switch (uri) {
    case '/config/schemas/north':
      jsonString = JSON.stringify(['a', 'b', 'c'])
      break
    case '/config/schemas/south':
      jsonString = JSON.stringify(['d', 'e', 'f'])
      break
    case '/config':
      jsonString = JSON.stringify({ config: testConfig })
      break
    case '/info':
      jsonString = JSON.stringify({ version: '1.0' })
      break
    default:
      jsonString = '""'
  }
  if (uri.includes('/logs')) {
    jsonString = JSON.stringify(logSample)
  }
  return {
    status: 200,
    text: jest.fn().mockImplementation(() => jsonString),
  }
})

describe('apis', () => {
  it('check getSouthProtocols', async () => {
    const result = await apis.getSouthTypes()
    expect(result).toEqual(['d', 'e', 'f'])
  })

  it('check getSouthProtocols with status 500', async () => {
    const originalError = console.error
    console.error = jest.fn()
    const originalGlobalFetchMock = global.fetch
    global.fetch = jest.fn().mockImplementation(() => ({ status: 500 }))

    const request = apis.getSouthTypes()
    await expect(request).rejects.toThrow()
    expect(console.error).toBeCalled()

    global.fetch = originalGlobalFetchMock
    console.error = originalError
  })

  it('check getSouthProtocols with catch error', async () => {
    const originalError = console.error
    console.error = jest.fn()
    const originalGlobalFetchMock = global.fetch
    const error = new Error('test error')
    global.fetch = jest.fn().mockImplementation(() => {
      throw error
    })

    const request = apis.getSouthTypes()
    await expect(request).rejects.toThrowError('test error')
    expect(console.error).toBeCalled()

    global.fetch = originalGlobalFetchMock
    console.error = originalError
  })

  it('check getNorthApis', async () => {
    const result = await apis.getNorthTypes()
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('check getConfig', async () => {
    const result = await apis.getConfig()
    expect(result).toEqual({ config: testConfig })
  })

  it('check updateConfig', async () => {
    const result = await apis.updateConfig()
    expect(result.status).toEqual(200)
  })

  it('check updateConfig status 500', async () => {
    const originalError = console.error
    console.error = jest.fn()
    const originalGlobalFetchMock = global.fetch
    global.fetch = jest.fn().mockImplementation(() => ({ status: 500, statusText: 'server error' }))

    const request = apis.updateConfig()
    await expect(request).rejects.toThrow()

    global.fetch = originalGlobalFetchMock
    console.error = originalError
  })

  it('check activateConfig', async () => {
    const result = await apis.activateConfig()
    expect(result.status).toEqual(200)
  })

  it('check getLogs with date', async () => {
    const result = await apis.getLogs('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', 'debug')
    expect(result).toEqual(logSample)
  })

  it('check getLogs', async () => {
    const result = await apis.getLogs('', '', 'debug')
    expect(result).toEqual(logSample)
  })

  it('check getStatus', async () => {
    const result = await apis.getOIBusInfo()
    expect(result).toEqual({ version: '1.0' })
  })
})
