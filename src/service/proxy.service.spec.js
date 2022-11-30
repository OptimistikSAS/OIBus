import EncryptionService from './encryption.service.js'
import ProxyService from './proxy.service.js'
import * as httpRequestStaticFunctions from './http-request-static-functions.js'

const proxies = [
  {
    name: 'proxy1',
    protocol: 'http',
    host: 'localhost',
    port: 8080,
    username: 'user',
    password: 'pass1',
  },
  {
    name: 'proxy2',
    protocol: 'https',
    host: 'localhost',
    port: 8080,
    username: 'user',
    password: 'pass2',
  },
]
jest.mock('./http-request-static-functions')
jest.mock('./encryption.service', () => ({ getInstance: () => ({ decryptText: jest.fn((password) => password) }) }))

describe('proxy service', () => {
  it('should get correct proxy agent', async () => {
    httpRequestStaticFunctions.createProxyAgent.mockImplementation(() => ({ proxyAgent: 'a field' }))
    const encryptionService = EncryptionService.getInstance()
    const proxyService = new ProxyService(proxies, encryptionService)

    expect(await proxyService.getProxy('proxy0')).toBeNull()
    expect(encryptionService.decryptText).not.toHaveBeenCalled()

    expect(await proxyService.getProxy('proxy1')).toEqual({ proxyAgent: 'a field' })
    expect(encryptionService.decryptText).toHaveBeenCalledWith('pass1')
  })
})
