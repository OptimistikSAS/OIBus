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
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.eventEmitters = {}

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock AWS
jest.mock('aws-sdk', () => ({ S3: jest.fn(), config: { update: jest.fn() } }))

// Mock ProxyAgent
jest.mock('proxy-agent')

beforeEach(() => {
  jest.resetAllMocks()
  ProxyAgent.mockClear()
})

describe('Amazone S3 north', () => {
  it('should be properly initialized', () => {
    const AmazonS3Config = config.north.applications[8]
    delete AmazonS3Config.AmazonS3.proxy
    const AmazonS3North = new AmazonS3(AmazonS3Config, engine)

    expect(AmazonS3North.bucket).toEqual(AmazonS3Config.AmazonS3.bucket)
    expect(AmazonS3North.folder).toEqual(AmazonS3Config.AmazonS3.folder)

    expect(AWS.config.update).toHaveBeenCalledWith({
      accessKeyId: AmazonS3Config.AmazonS3.authentication.key,
      secretAccessKey: AmazonS3Config.AmazonS3.authentication.secretKey,
    })
    expect(AWS.S3).toHaveBeenCalledTimes(1)
    expect(AmazonS3North.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy', () => {
    const AmazonS3Config = config.north.applications[8]
    AmazonS3Config.AmazonS3.proxy = 'sss'
    const AmazonS3North = new AmazonS3(AmazonS3Config, engine)

    expect(AmazonS3North.bucket).toEqual(AmazonS3Config.AmazonS3.bucket)
    expect(AmazonS3North.folder).toEqual(AmazonS3Config.AmazonS3.folder)

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
      accessKeyId: AmazonS3Config.AmazonS3.authentication.key,
      secretAccessKey: AmazonS3Config.AmazonS3.authentication.secretKey,
    })
    expect(AWS.S3).toHaveBeenCalledTimes(1)
    expect(AWS.config.update).toHaveBeenCalledTimes(2)
    expect(AmazonS3North.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy without authentication', () => {
    const AmazonS3Config = config.north.applications[8]
    AmazonS3Config.AmazonS3.proxy = 'no-auth'
    const AmazonS3North = new AmazonS3(AmazonS3Config, engine)

    expect(AmazonS3North.bucket).toEqual(AmazonS3Config.AmazonS3.bucket)
    expect(AmazonS3North.folder).toEqual(AmazonS3Config.AmazonS3.folder)

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
      accessKeyId: AmazonS3Config.AmazonS3.authentication.key,
      secretAccessKey: AmazonS3Config.AmazonS3.authentication.secretKey,
    })
    expect(AWS.S3).toHaveBeenCalledTimes(1)
    expect(AWS.config.update).toHaveBeenCalledTimes(2)
    expect(AmazonS3North.canHandleFiles).toBeTruthy()
  })

  it('should properly handle file', async () => {
    const AmazonS3Config = config.north.applications[8]
    const AmazonS3North = new AmazonS3(AmazonS3Config, engine)
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    const expectedParams = {
      Bucket: AmazonS3Config.AmazonS3.bucket,
      Body: [],
      Key: `${AmazonS3Config.AmazonS3.folder}/file.csv`,
    }

    AmazonS3North.s3.upload = jest.fn(() => ({ promise: jest.fn() }))
    const expectedResult = await AmazonS3North.handleFile(filePath)

    expect(fs.createReadStream).toHaveBeenCalledWith(filePath)
    expect(AmazonS3North.s3.upload).toHaveBeenCalledWith(expectedParams)
    expect(expectedResult).toEqual(ApiHandler.STATUS.SUCCESS)
  })

  it('should properly catch handle file error', async () => {
    const AmazonS3Config = config.north.applications[8]
    const AmazonS3North = new AmazonS3(AmazonS3Config, engine)
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    AmazonS3North.s3.upload = jest.fn(() => ({
      promise: () => {
        throw new Error('test')
      },
    }))
    const expectedResult = await AmazonS3North.handleFile(filePath)
    expect(AmazonS3North.logger.error).toHaveBeenCalledTimes(1)
    expect(expectedResult).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })
})
