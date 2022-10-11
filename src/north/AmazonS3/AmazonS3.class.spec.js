const fs = require('node:fs')

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')
const ProxyAgent = require('proxy-agent')

const AmazonS3 = require('./AmazonS3.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock AWS
jest.mock('@aws-sdk/client-s3', () => ({ S3Client: jest.fn(), PutObjectCommand: jest.fn() }))
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }))

// Mock ProxyAgent
jest.mock('proxy-agent')

// Mock fs
jest.mock('node:fs/promises')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

let settings = null
let north = null

describe('North Amazon S3', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    settings = {
      id: 'northId',
      name: 'test04',
      type: 'AmazonS3',
      enabled: false,
      AmazonS3: {
        bucket: 'aef',
        region: 'eu-west-3',
        folder: 'azsdfcv',
        proxy: '',
        authentication: {
          key: 'myAccessKey',
          secretKey: 'mySecretKey',
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
    north = new AmazonS3(settings, engine)
    await north.init()
  })

  it('should be properly initialized', () => {
    expect(north.bucket).toEqual(settings.AmazonS3.bucket)
    expect(north.folder).toEqual(settings.AmazonS3.folder)

    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: settings.AmazonS3.authentication.key,
        secretAccessKey: settings.AmazonS3.authentication.secretKey,
      },
      requestHandler: null,
    })
    expect(S3Client).toHaveBeenCalledTimes(1)
    expect(north.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy', async () => {
    const amazonS3WithProxyConfig = settings
    amazonS3WithProxyConfig.AmazonS3.proxy = 'sss'
    north.engineConfig.proxies = [
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

    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, engine)
    await amazonS3WithProxy.init()

    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: settings.AmazonS3.authentication.key,
        secretAccessKey: settings.AmazonS3.authentication.secretKey,
      },
      requestHandler: expectedAgent,
    })
    expect(amazonS3WithProxy.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy without authentication', async () => {
    const amazonS3WithProxyConfig = settings
    amazonS3WithProxyConfig.AmazonS3.proxy = 'no-auth'

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

    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, engine)
    await amazonS3WithProxy.init()

    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: settings.AmazonS3.authentication.key,
        secretAccessKey: settings.AmazonS3.authentication.secretKey,
      },
      requestHandler: expectedAgent,
    })
    expect(amazonS3WithProxy.canHandleFiles).toBeTruthy()
  })

  it('should properly handle file', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    const expectedParams = {
      Bucket: settings.AmazonS3.bucket,
      Body: [],
      Key: `${settings.AmazonS3.folder}/file.csv`,
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
