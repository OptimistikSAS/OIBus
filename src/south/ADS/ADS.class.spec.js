const ADS = require('./ADS.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.createMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

describe('ADS south', () => {
  const adsConfig = {
    dataSourceId: 'ADS',
    protocol: 'ADS',
    enabled: true,
    ADS: {
      netId: '127.0.0.1.1.1',
      port: 851,
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        address: 'Etat.BB2T0',
        scanMode: 'every10Seconds',
      },
      {
        pointId: 'EtatBB2T1',
        address: 'Etat.BB2T1',
        scanMode: 'every10Seconds',
      },
    ],
  }

  it('should be properly initialized', () => {
    const adsSouth = new ADS(adsConfig, engine)

    expect(adsSouth.netId)
      .toEqual(adsConfig.ADS.netId)
    expect(adsSouth.port)
      .toEqual(adsConfig.ADS.port)
  })

  it('should properly connect', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const adsSouth = new ADS(adsConfig, engine)
    await adsSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${adsConfig.dataSourceId}.db`)
  })

  it('should properly onScan', async () => {
    const adsSouth = new ADS(adsConfig, engine)

    await adsSouth.connect()
    adsSouth.connected = true
    adsSouth.client.readSymbol = jest.fn()
    adsSouth.client.readSymbol.mockReturnValue(Promise.resolve([]))
    await adsSouth.onScan('every10Seconds')

    expect(adsSouth.client.readSymbol)
      .toBeCalledWith('Etat.BB2T0') // see the optimizedScanModes to get the startAddress and range
    expect(adsSouth.client.readSymbol)
      .toBeCalledTimes(2) // two points are set in the config
  })

  it('should properly disconnect', async () => {
    const adsSouth = new ADS(adsConfig, engine)

    // activate flag connect
    adsSouth.connected = true

    adsSouth.client = { disconnect: jest.fn(), readSymbol: jest.fn() }
    adsSouth.client.disconnect.mockReturnValue(Promise.resolve([]))
    await adsSouth.disconnect()
    expect(adsSouth.client.disconnect)
      .toBeCalled()

    await adsSouth.onScan()

    expect(adsSouth.client.readSymbol)
      .not
      .toBeCalled()
  })
})
