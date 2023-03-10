import fs from 'node:fs'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'

import AmazonS3 from './north-amazon-s3.js'

// Mock AWS
jest.mock('@aws-sdk/client-s3', () => ({ S3Client: jest.fn(), PutObjectCommand: jest.fn() }))
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }))

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/certificate.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../service/cache/value-cache.service')
jest.mock('../../service/cache/file-cache.service')
jest.mock('../../service/cache/archive.service')
jest.mock('../../service/proxy.service')

const proxies = [
  {
    name: 'sss',
    protocol: 'http',
    host: 'hhh',
    port: 123,
    username: 'uuu',
    password: 'pppppppppp',
  },
  {
    name: 'ff',
    protocol: 'http',
    host: 'tt',
    port: 1,
    username: 'uii',
    password: 'ppppppppppppp',
  },
  {
    name: 'no-auth',
    protocol: 'http',
    host: 'tt',
    port: 1,
  },
]

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

const proxyService = { getProxy: jest.fn() }

let configuration = null
let north = null

describe('NorthAmazonS3', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    proxyService.getProxy.mockReturnValue(null)

    configuration = {
      id: 'northId',
      name: 'test04',
      type: 'AmazonS3',
      enabled: false,
      settings: {
        bucket: 'aef',
        region: 'eu-west-3',
        folder: 'azsdfcv',
        proxy: '',
        authentication: {
          key: 'myAccessKey',
          secret: 'mySecretKey',
        },
      },
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
      subscribedTo: [],
    }
    north = new AmazonS3(configuration, proxyService, logger)
    await north.start()
  })

  it('should be properly initialized', () => {
    expect(north.bucket).toEqual(configuration.settings.bucket)
    expect(north.folder).toEqual(configuration.settings.folder)
    expect(north.proxyService.getProxy).toHaveBeenCalledWith('')

    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: configuration.settings.authentication.key,
        secretAccessKey: configuration.settings.authentication.secret,
      },
      requestHandler: null,
    })
    expect(S3Client).toHaveBeenCalledTimes(1)
    expect(north.manifest.modes.points).toBeFalsy()
    expect(north.manifest.modes.files).toBeTruthy()
  })

  it('should be properly initialized with a proxy', async () => {
    const amazonS3WithProxyConfig = configuration
    amazonS3WithProxyConfig.settings.proxy = 'sss'

    proxyService.getProxy.mockReturnValue(proxies[0])

    const expectedAgent = {
      auth: 'uuu:pppppppppp',
      hash: null,
      host: 'hhh:123',
      hostname: 'hhh',
      href: 'http://hhh:123/',
      path: '/',
      pathname: '/',
      port: '123',
      protocol: 'http:',
      query: null,
      search: null,
      slashes: true,
    }
    NodeHttpHandler.mockReturnValueOnce(expectedAgent)

    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, proxyService, logger)
    await amazonS3WithProxy.start()

      expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.settings.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.settings.folder)

    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: configuration.settings.authentication.key,
        secretAccessKey: configuration.settings.authentication.secret,
      },
      requestHandler: expectedAgent,
    })
  })

  it('should be properly initialized with a proxy without authentication', async () => {
    const amazonS3WithProxyConfig = configuration
    amazonS3WithProxyConfig.settings.proxy = 'no-auth'

    proxyService.getProxy.mockReturnValue(proxies[2])

    const expectedAgent = {
      auth: null,
      hash: null,
      host: 'tt:1',
      hostname: 'tt',
      href: 'http://tt:1/',
      path: '/',
      pathname: '/',
      port: '1',
      protocol: 'http:',
      query: null,
      search: null,
      slashes: true,
    }
    NodeHttpHandler.mockReturnValueOnce(expectedAgent)

    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, proxyService, logger)
    await amazonS3WithProxy.start()

      expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.settings.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.settings.folder)

    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: configuration.settings.authentication.key,
        secretAccessKey: configuration.settings.authentication.secret,
      },
      requestHandler: expectedAgent,
    })
  })

  it('should properly handle file', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    const expectedParams = {
      Bucket: configuration.settings.bucket,
      Body: [],
      Key: `${configuration.settings.folder}/file.csv`,
    }

    PutObjectCommand.mockReturnValueOnce(expectedParams)
    north.s3.send = jest.fn(() => ({ promise: jest.fn() }))
    await north.handleFile(filePath)

    expect(fs.createReadStream).toHaveBeenCalledWith(filePath)
    expect(north.s3.send).toHaveBeenCalledWith(expectedParams)
  })

  it('should properly catch handle file error', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    north.s3.send = jest.fn(() => {
      throw new Error('test')
    })
    await expect(north.handleFile(filePath)).rejects.toThrowError('test')
  })
})
