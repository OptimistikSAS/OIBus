const mongodb = require('mongodb')

const MongoDB = require('./MongoDB.class')
const config = require('../../config/defaultConfig.json')
const EncryptionService = require('../../services/EncryptionService.class')

const { NorthHandler } = global

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

jest.mock('mongodb', () => ({ MongoClient: jest.fn() }))

const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
const MongoDBConfig = {
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
}
const values = [
  {
    pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
    timestamp,
    data: {
      value: 666,
      quality: 'good',
    },
  },
]

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
})

describe('MongoDB north', () => {
  it('should properly connect and disconnect', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()

    expect(mongoDbNorth.canHandleValues)
      .toBeTruthy()
    expect(mongoDbNorth.canHandleFiles)
      .toBeFalsy()

    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn((callback) => callback(null, [{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: jest.fn(), createIndex: jest.fn((index, callback) => callback()) })),
      createCollection: jest.fn((collection, callback) => callback()),
    }

    const client = {
      connect: jest.fn((callback) => callback()),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()
    expect(mongoDbNorth.logger.info).toHaveBeenCalledWith('Connecting undefined to MongoDB: mongodb://user:<password>@host')
    expect(mongoDbNorth.logger.info).toHaveBeenCalledWith('North API undefined started with protocol undefined url: mongodb://user:password@host')
    expect(mongoDbNorth.listCollections).toEqual([{ name: 'collection1' }, { name: 'collection2' }])

    mongoDbNorth.user = ''
    await mongoDbNorth.connect()
    expect(mongoDbNorth.logger.info).toHaveBeenCalledWith('Connecting undefined to MongoDB: mongodb://host')

    await mongoDbNorth.disconnect()

    expect(client.close).toHaveBeenCalled()
  })

  it('should fail to connect', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()
    const client = {
      connect: jest.fn((callback) => callback('connection error')),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('Error during connection to MongoDB: connection error')

    mongoDbNorth.client = null
    await mongoDbNorth.disconnect()

    expect(client.close).not.toHaveBeenCalled()
  })

  it('should fail to list collections', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()
    const client = {
      connect: jest.fn((callback) => callback()),
      db: jest.fn(() => ({ listCollections: jest.fn(() => ({ toArray: jest.fn((callback) => callback(('list error'), null)) })) })),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()

    expect(mongoDbNorth.listCollections).toEqual([])
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('list error')
  })

  it('should properly handle values', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()
    mongoDbNorth.createCollection = true

    const inserManyFunction = jest.fn()
    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn((callback) => callback(null, [{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: inserManyFunction, createIndex: jest.fn((index, callback) => callback()) })),
      createCollection: jest.fn((collection, callback) => callback()),
    }

    const client = {
      connect: jest.fn((callback) => callback()),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()

    await mongoDbNorth.handleValues(values)
    expect(mongoDbNorth.logger.info).toHaveBeenCalledWith('Collection "SENSOR_TABLE" successfully created')
    expect(mongoDbNorth.logger.info).toHaveBeenCalledWith('Collection indexes successfully created for collection "SENSOR_TABLE"')
    expect(mongoDbNorth.collectionChecked).toBeTruthy()
    expect(inserManyFunction).toHaveBeenCalledWith(
      [{ quality: 'good', sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '666', timestamp: '2020-02-29T12:12:12.000Z' }],
    )

    mongoDbNorth.useDataKeyValue = true
    mongoDbNorth.keyParentValue = 'level'
    mongoDbNorth.timestampPathInDataValue = 'timestamp'
    await mongoDbNorth.handleValues([{
      pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
      data: {
        value: { level: { value: 666, timestamp } },
        quality: 'good',
      },
    }, {
      pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
      data: {
        value: { level: { value: 777, timestamp } },
        quality: 'good',
      },
    }])
    // eslint-disable-next-line max-len
    expect(inserManyFunction).toHaveBeenCalledWith([{ sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '666', timestamp: '2020-02-29T12:12:12.000Z' }, { sensor: 'ANA/BL1RCP05', site: 'SITE1', unit: 'UNIT1', value: '777', timestamp: '2020-02-29T12:12:12.000Z' }])
  })

  it('should not create collection if it already exists', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()

    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn((callback) => callback(null, [{ name: 'collection1' }, { name: 'collection2' }])) })),
      createCollection: jest.fn((collection, callback) => callback()),
    }

    const client = {
      connect: jest.fn((callback) => callback()),
      db: jest.fn(() => mongoDatabase),
    }
    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()

    expect(mongoDbNorth.listCollections).toEqual([{ name: 'collection1' }, { name: 'collection2' }])
    await mongoDbNorth.ensureCollectionExists('collection1', null, null)

    expect(mongoDbNorth.mongoDatabase.createCollection).not.toHaveBeenCalled()
    expect(mongoDbNorth.collectionChecked).toBeTruthy()
  })

  it('should properly manage handle values errors', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()

    mongoDbNorth.makeRequest = jest.fn(() => Promise.reject(new Error('request error')))

    try {
      await mongoDbNorth.handleValues(values)
    } catch (error) {
      expect(mongoDbNorth.logger.error).toHaveBeenCalledWith(new Error('request error'))
      expect(error).toEqual(NorthHandler.STATUS.COMMUNICATION_ERROR)
    }
  })

  it('should properly manage collection creation errors', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()

    mongoDbNorth.mongoDatabase = {
      collection: jest.fn(() => ({ insertMany: jest.fn(), createIndex: jest.fn((index, callback) => callback('createIndexError')) })),
      createCollection: jest.fn((collection, callback) => callback('createCollectionError')),
    }
    mongoDbNorth.listCollections = [{ name: 'collection1' }, { name: 'collection2' }]
    await mongoDbNorth.ensureCollectionExists('collection3', ['index1', 'index2'], 'timestampKey')
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('Error during the creation of collection "collection3": createCollectionError')

    mongoDbNorth.mongoDatabase = {
      collection: jest.fn(() => ({ insertMany: jest.fn(), createIndex: jest.fn((index, callback) => callback('createIndexError')) })),
      createCollection: jest.fn((collection, callback) => callback(null)),
    }
    await mongoDbNorth.ensureCollectionExists('collection3', ['index1', 'index2'], 'timestampKey')
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('Error during the creation of indexes for collection "collection3": createIndexError')
  })

  it('should properly handle values with index fields and collection values errors', async () => {
    const mongoDbNorth = new MongoDB({ MongoDB: MongoDBConfig }, engine)
    await mongoDbNorth.init()

    const inserManyFunction = jest.fn()
    const mongoDatabase = {
      listCollections: jest.fn(() => ({ toArray: jest.fn((callback) => callback(null, [{ name: 'collection1' }, { name: 'collection2' }])) })),
      collection: jest.fn(() => ({ insertMany: inserManyFunction, createIndex: jest.fn((index, callback) => callback()) })),
      createCollection: jest.fn((collection, callback) => callback()),
    }

    const client = {
      connect: jest.fn((callback) => callback()),
      db: jest.fn(() => mongoDatabase),
      close: jest.fn(),
    }

    mongodb.MongoClient.mockReturnValue(client)
    await mongoDbNorth.connect()

    mongoDbNorth.collection = '%9$s'

    await mongoDbNorth.makeRequest(values)

    // eslint-disable-next-line max-len
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('RegExp returned by (.*)-(.*)-(.*)-(.*) for SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05 doesn\'t have enough groups for collection')

    mongoDbNorth.collection = '%1$s'
    mongoDbNorth.indexFields = '%9$s'
    await mongoDbNorth.makeRequest(values)

    // eslint-disable-next-line max-len
    expect(mongoDbNorth.logger.error).toHaveBeenCalledWith('RegExp returned by (.*)-(.*)-(.*)-(.*) for SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05 doesn\'t have enough groups for indexes')
  })
})
