const ads = require('ads-client')
const ADS = require('./ADS.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

// Mock ads client
jest.mock('ads-client')

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.createMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addValues = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  // Mock ads Client constructor and the used function
  ads.Client.mockReturnValue({
    connect: () => new Promise((resolve) => resolve({})),
    disconnect: () => new Promise((resolve) => resolve()),
    readSymbol: jest.fn(), // () => new Promise((resolve) => resolve()),
  })
  databaseService.getConfig.mockReturnValue('1587640141001.0')
})

describe('ADS south', () => {
  const adsConfig = {
    dataSourceId: 'ADS',
    protocol: 'ADS',
    enabled: true,
    ADS: {
      netId: '127.0.0.1.1.1',
      port: 851,
      routerAddress: '10.211.55.3',
      routerTcpPort: 48898,
      clientAmsNetId: '10.211.55.2.1.1',
      clientAdsPort: 32750,
      retryInterval: 10000,
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
    const adsSouth = new ADS(adsConfig, engine)
    await adsSouth.connect()
    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${adsConfig.dataSourceId}.db`)

    expect(adsSouth.connected)
      .toBeTruthy()

    expect(adsSouth.reconnectTimeout).toBe(null)
  })

  it('should retry to connect in case of failure', async () => {
    const adsSouth = new ADS(adsConfig, engine)
    adsSouth.client = { connect: () => new Promise((resolve, reject) => reject()) }
    await adsSouth.connectToAdsServer()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(adsSouth.logger.error)
      .toBeCalledTimes(1)

    expect(adsSouth.reconnectTimeout).not.toBe(null)
  })

  it('should properly onScan', async () => {
    const adsSouth = new ADS(adsConfig, engine)
    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn() }
    adsSouth.client.readSymbol.mockReturnValue(new Promise((resolve) => resolve([])))
    await adsSouth.onScan('every10Seconds')

    expect(adsSouth.client.readSymbol)
      .toBeCalledWith('Etat.BB2T0') // see the optimizedScanModes to get the startAddress and range
    expect(adsSouth.client.readSymbol)
      .toBeCalledTimes(2) // two points are set in the config
    expect(adsSouth.logger.error)
      .toBeCalledTimes(0)
  })

  it('should not read when no point', async () => {
    const adsSouth = new ADS(adsConfig, engine)

    await adsSouth.connect()
    await adsSouth.onScan('every5Seconds')
    // no point for every5Seconds
    expect(adsSouth.client.readSymbol)
      .toBeCalledTimes(0)
  })

  it('should catch errors on scan', async () => {
    const adsSouth = new ADS(adsConfig, engine)

    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn() }
    adsSouth.client.readSymbol.mockReturnValue(new Promise((resolve, reject) => reject(new Error('test'))))
    await adsSouth.onScan('every10Seconds')

    expect(adsSouth.logger.error)
      .toBeCalledTimes(2)
  })

  it('should properly disconnect and clearTimeout', async () => {
    const adsSouth = new ADS(adsConfig, engine)
    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn(), disconnect: jest.fn() }
    adsSouth.client.disconnect.mockReturnValue(new Promise((resolve) => resolve()))

    adsSouth.reconnectTimeout = true
    await adsSouth.disconnect()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(clearTimeout).toHaveBeenCalledTimes(1)

    await adsSouth.onScan()

    expect(adsSouth.client.readSymbol)
      .not
      .toBeCalled()
  })

  it('disconnect should do nothing if not connected', async () => {
    const adsSouth = new ADS(adsConfig, engine)
    adsSouth.connected = false

    adsSouth.client = { disconnect: jest.fn() }
    adsSouth.client.disconnect.mockReturnValue(new Promise((resolve) => resolve()))
    await adsSouth.disconnect()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(adsSouth.client.disconnect)
      .not
      .toBeCalled()
  })
})
