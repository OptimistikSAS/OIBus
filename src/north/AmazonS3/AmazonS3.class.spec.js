import { jest } from '@jest/globals'

import fs from 'node:fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import ProxyAgent from 'proxy-agent'

import ApiHandler from '../ApiHandler.class.js'
import AmazonS3 from './AmazonS3.class.js'
import { defaultConfig } from '../../../tests/testConfig.js'
import EncryptionService from '../../services/EncryptionService.class.js'

// Mock database service
jest.mock('../../services/database.service', () => {
})

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }
engine.eventEmitters = {}

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock AWS
jest.mock('@aws-sdk/client-s3', () => ({ S3Client: jest.fn(), PutObjectCommand: jest.fn() }))
jest.mock('@aws-sdk/node-http-handler', () => ({ NodeHttpHandler: jest.fn() }))

// Mock ProxyAgent
jest.mock('proxy-agent')

let amazonS3 = null
const amazonS3Config = {
  id: 'north-aws',
  name: 'test04',
  api: 'AmazonS3',
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
    sendInterval: 10000,
    retryInterval: 5000,
    groupCount: 1000,
    maxSendCount: 10000,
  },
  subscribedTo: [],
}

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

    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: amazonS3Config.AmazonS3.authentication.key,
        secretAccessKey: amazonS3Config.AmazonS3.authentication.secretKey,
      },
      requestHandler: null,
    })
    expect(S3Client).toHaveBeenCalledTimes(1)
    expect(amazonS3.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy', () => {
    const amazonS3WithProxyConfig = amazonS3Config
    amazonS3WithProxyConfig.AmazonS3.proxy = 'sss'
    amazonS3.engineConfig.proxies = [
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
    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: amazonS3Config.AmazonS3.authentication.key,
        secretAccessKey: amazonS3Config.AmazonS3.authentication.secretKey,
      },
      requestHandler: expectedAgent,
    })
    expect(amazonS3WithProxy.canHandleFiles).toBeTruthy()
  })

  it('should be properly initialized with a proxy without authentication', () => {
    const amazonS3WithProxyConfig = amazonS3Config
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
    expect(amazonS3WithProxy.bucket).toEqual(amazonS3WithProxyConfig.AmazonS3.bucket)
    expect(amazonS3WithProxy.folder).toEqual(amazonS3WithProxyConfig.AmazonS3.folder)

    expect(ProxyAgent).toHaveBeenCalledWith(expectedAgent)
    expect(S3Client).toHaveBeenCalledWith({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: amazonS3Config.AmazonS3.authentication.key,
        secretAccessKey: amazonS3Config.AmazonS3.authentication.secretKey,
      },
      requestHandler: expectedAgent,
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

    PutObjectCommand.mockReturnValueOnce(expectedParams)
    amazonS3.s3.send = jest.fn(() => ({ promise: jest.fn() }))
    const expectedResult = await amazonS3.handleFile(filePath)

    expect(fs.createReadStream).toHaveBeenCalledWith(filePath)
    expect(amazonS3.s3.send).toHaveBeenCalledWith(expectedParams)
    expect(expectedResult).toEqual(ApiHandler.STATUS.SUCCESS)
  })

  it('should properly catch handle file error', async () => {
    const filePath = '/csv/test/file-789.csv'
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])

    amazonS3.s3.send = jest.fn(() => {
      throw new Error('test')
    })
    const expectedResult = await amazonS3.handleFile(filePath)
    expect(amazonS3.logger.error).toHaveBeenCalledTimes(1)
    expect(expectedResult).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })
})
