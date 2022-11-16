const mongodb = require('mongodb')

const MongoDB = require('./north-mongo-db')

jest.mock('mongodb', () => ({ MongoClient: jest.fn() }))

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

const nowDateString = '2020-02-02T02:02:02.222Z'
const values = [
  {
    pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
    timestamp: new Date(nowDateString).toISOString(),
    data: {
      value: 666,
      quality: 'good',
    },
  },
]
let configuration = null
let north = null

describe('NorthMongoDB', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'northId',
      name: 'mongo',
      type: 'MongoDB',
      settings: {
        password: 'password',
        createCollection: false,
        useDataKeyValue: false,
        user: 'user',
        host: 'host',
        db: 'database',
        regExp: '(.*)-(.*)-(.*)-(.*)',
        collection: '%1$s',
        indexFields: 'site:%2$s,unit:%3$s,sensor:%4$s',
        timeStampKey: 'timestamp',
        keyParentValue: '',
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
    }
    north = new MongoDB(configuration, [])
  })

  it('should properly connect and disconnect', async () => {
    await north.start('baseFolder', 'oibusName', {})

    expect(north.canHandleValues).toBeTruthy()
    expect(north.canHandleFiles).toBeFalsy()

    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn(() => ([{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: jest.fn(), createIndex: jest.fn() })),
      createCollection: jest.fn(),
    }
    const client = {
      connect: jest.fn(),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await north.connect()
    expect(north.logger.info).toHaveBeenCalledWith('Connecting North "mongo" to MongoDB: mongodb://user:<password>@host')
    expect(north.logger.info).toHaveBeenCalledWith('North connector "mongo" of type MongoDB started with url: '
        + 'mongodb://user:password@host.')
    expect(north.listCollections).toEqual([{ name: 'collection1' }, { name: 'collection2' }])

    north.user = ''
    await north.connect()
    expect(north.logger.info).toHaveBeenCalledWith('Connecting North "mongo" to MongoDB: mongodb://host')

    await north.disconnect()

    expect(client.close).toHaveBeenCalled()
  })

  it('should fail to connect', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const client = {
      connect: jest.fn(() => {
        throw new Error('connection error')
      }),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await expect(north.connect()).rejects.toThrowError('connection error')

    north.client = null
    await north.disconnect()

    expect(client.close).not.toHaveBeenCalled()
  })

  it('should fail to list collections', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const client = {
      connect: jest.fn(),
      db: jest.fn(() => ({
        listCollections: jest.fn(() => ({
          toArray: jest.fn(() => {
            throw new Error('list error')
          }),
        })),
      })),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await expect(north.connect()).rejects.toThrowError('list error')
  })

  it('should properly handle values', async () => {
    await north.start('baseFolder', 'oibusName', {})

    north.createCollection = true

    const insertManyFunction = jest.fn()
    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn(() => ([{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: insertManyFunction, createIndex: jest.fn() })),
      createCollection: jest.fn(),
    }

    const client = {
      connect: jest.fn(),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await north.connect()

    await north.handleValues(values)
    expect(north.logger.info).toHaveBeenCalledWith('Collection "SENSOR_TABLE" successfully created.')
    expect(north.logger.info).toHaveBeenCalledWith('Collection indexes successfully created for collection "SENSOR_TABLE".')
    expect(north.collectionExists).toBeTruthy()
    expect(insertManyFunction).toHaveBeenCalledWith(
      [{ quality: 'good', sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '666', timestamp: nowDateString }],
    )

    north.useDataKeyValue = true
    north.keyParentValue = 'level'
    north.timestampPathInDataValue = 'timestamp'
    await north.handleValues([{
      pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
      data: {
        value: { level: { value: 666, timestamp: new Date(nowDateString).toISOString() } },
        quality: 'good',
      },
    }, {
      pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
      data: {
        value: { level: { value: 777, timestamp: new Date(nowDateString).toISOString() } },
        quality: 'good',
      },
    }])
    expect(insertManyFunction).toHaveBeenCalledWith([
      { sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '666', timestamp: nowDateString },
      { sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '777', timestamp: nowDateString }])
  })

  it('should not create collection if it already exists', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn(() => ([{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: jest.fn(), createIndex: jest.fn() })),
      createCollection: jest.fn(),
    }

    const client = {
      connect: jest.fn(),
      db: jest.fn(() => mongoDatabase),
    }
    mongodb.MongoClient.mockReturnValue(client)
    await north.connect()

    expect(north.listCollections).toEqual([{ name: 'collection1' }, { name: 'collection2' }])
    await north.ensureCollectionExists('collection1', null, null)

    expect(north.mongoDatabase.createCollection).not.toHaveBeenCalled()
    expect(north.collectionExists).toBeTruthy()
  })

  it('should properly manage collection creation errors', async () => {
    await north.start('baseFolder', 'oibusName', {})

    north.mongoDatabase = {
      collection: jest.fn(() => ({
        insertMany: jest.fn(),
        createIndex: jest.fn(() => {
          throw new Error('createIndexError')
        }),
      })),
      createCollection: jest.fn(() => {
        throw new Error('createCollectionError')
      }),
    }
    north.listCollections = [{ name: 'collection1' }, { name: 'collection2' }]
    await expect(north.ensureCollectionExists(
      'collection3',
      ['index1', 'index2'],
      'timestampKey',
    )).rejects.toThrowError('createCollectionError')

    north.mongoDatabase = {
      collection: jest.fn(() => ({
        insertMany: jest.fn(),
        createIndex: jest.fn(() => {
          throw new Error('createIndexError')
        }),
      })),
      createCollection: jest.fn(),
    }
    await expect(north.ensureCollectionExists(
      'collection3',
      ['index1', 'index2'],
      'timestampKey',
    )).rejects.toThrowError('createIndexError')
  })

  it('should properly handle values with index fields and collection values errors', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const insertManyFunction = jest.fn()
    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn(() => ([{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: insertManyFunction, createIndex: jest.fn() })),
      createCollection: jest.fn(),
    }

    const client = {
      connect: jest.fn(),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await north.connect()

    north.collection = '%9$s'

    await north.handleValues(values)

    expect(north.logger.error).toHaveBeenCalledWith('RegExp returned by (.*)-(.*)-(.*)-(.*) for '
        + 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05 doesn\'t have enough groups for the collection.')

    north.collection = '%1$s'
    north.indexFields = '%9$s'
    await north.handleValues(values)

    expect(north.logger.error).toHaveBeenCalledWith('RegExp returned by (.*)-(.*)-(.*)-(.*) for '
        + 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05 doesn\'t have enough groups for indexes.')
  })
})
