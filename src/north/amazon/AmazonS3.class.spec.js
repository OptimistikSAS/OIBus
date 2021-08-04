const fs = require('fs')
const AWS = require('aws-sdk')
const ProxyAgent = require('proxy-agent')
const ApiHandler = require('../ApiHandler.class')
const AmazonS3 = require('./AmazonS3.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock database service
jest.mock('../../services/database.service', () => {
})

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.eventEmitters = {}

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock AWS
jest.mock('aws-sdk', () => ({ S3: jest.fn(), config: { update: jest.fn() } }))

// Mock ProxyAgent
jest.mock('proxy-agent')

let amazonS3 = null
const amazonS3Config = config.north.applications[8]

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetAllMocks()
  jest.restoreAllMocks()
  ProxyAgent.mockClear()
  amazonS3 = new AmazonS3(amazonS3Config, engine)
  amazonS3.init()
})

describe('Amazone S3 north', () => {
  it('should be properly initialized', () => {
    expect(amazonS3.bucket).toEqual(amazonS3Config.AmazonS3.bucket)
    expect(amazonS3.folder).toEqual(amazonS3Config.AmazonS3.folder)

    expect(AWS.config.update).toHaveBeenCalledWith({
      accessKeyId: amazonS3Config.AmazonS3.authentication.key,
      secretAccessKey: amazonS3Config.AmazonS3.authentication.secretKey,
    })
    expect(AWS.S3).toHaveBeenCalledTimes(1)
    expect(amazonS3.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy', () => {
    const amazonS3WithProxyConfig = amazonS3Config
    amazonS3WithProxyConfig.AmazonS3.proxy = 'sss'
    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, engine)
    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    const expectedAgent = {
      auth: 'uuu:pppppppppp',
      hash: null,
      host: null,
      hostname: null,
      href: '://hhh:123',
      path: '://hhh:123',
      pathname: '://hhh:123',
      port: null,
      protocol: null,
      query: null,
      search: null,
      slashes: null,
    }
    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(AWS.config.update).toHaveBeenCalledWith({
      accessKeyId: amazonS3WithProxyConfig.AmazonS3.authentication.key,
      secretAccessKey: amazonS3WithProxyConfig.AmazonS3.authentication.secretKey,
    })
    expect(amazonS3WithProxy.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy without authentication', () => {
    const amazonS3WithProxyConfig = amazonS3Config
    amazonS3WithProxyConfig.AmazonS3.proxy = 'no-auth'
    const amazonS3WithProxy = new AmazonS3(amazonS3WithProxyConfig, engine)
    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    const expectedAgent = {
      auth: null,
      hash: null,
      host: null,
      hostname: null,
      href: '://tt:1',
      path: '://tt:1',
      pathname: '://tt:1',
      port: null,
      protocol: null,
      query: null,
      search: null,
      slashes: null,
    }
    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(AWS.config.update).toHaveBeenCalledWith({
      accessKeyId: amazonS3WithProxyConfig.AmazonS3.authentication.key,
      secretAccessKey: amazonS3WithProxyConfig.AmazonS3.authentication.secretKey,
    })
    expect(amazonS3WithProxy.canHandleFiles).toBeTruthy()
  })

  it('should properly handle file', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    const expectedParams = {
      Bucket: amazonS3Config.AmazonS3.bucket,
      Body: [],
      Key: `${amazonS3Config.AmazonS3.folder}/file.csv`,
    }

    amazonS3.s3.upload = jest.fn(() => ({ promise: jest.fn() }))
    const expectedResult = await amazonS3.handleFile(filePath)

    expect(fs.createReadStream).toHaveBeenCalledWith(filePath)
    expect(amazonS3.s3.upload).toHaveBeenCalledWith(expectedParams)
    expect(expectedResult).toEqual(ApiHandler.STATUS.SUCCESS)
  })

  it('should properly catch handle file error', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    amazonS3.s3.upload = jest.fn(() => ({
      promise: () => {
        throw new Error('test')
      },
    }))
    const expectedResult = await amazonS3.handleFile(filePath)
    expect(amazonS3.logger.error).toHaveBeenCalledTimes(1)
    expect(expectedResult).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })
})
