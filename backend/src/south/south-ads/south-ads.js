import ads from 'ads-client'

import manifest from './manifest.ts'
import SouthConnector from '../south-connector.ts'

/**
 * Class SouthADS - Provides instruction for TwinCAT ADS client connection
 */
export default class SouthADS extends SouthConnector {
  static category = manifest.category

  /**
   * Constructor for SouthADS
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      manifest,
    )

    const {
      netId,
      port,
      clientAmsNetId,
      clientAdsPort,
      routerAddress,
      routerTcpPort,
      retryInterval,
      plcName,
      enumAsText,
      boolAsText,
      structureFiltering,
    } = configuration.settings
    this.netId = netId
    this.port = port
    this.clientAmsNetId = clientAmsNetId
    this.clientAdsPort = clientAdsPort
    this.routerAddress = routerAddress
    this.routerTcpPort = routerTcpPort
    this.retryInterval = retryInterval
    this.plcName = plcName
    this.boolAsText = boolAsText
    this.enumAsText = enumAsText
    this.structureFiltering = structureFiltering

    // Initialized at connection
    this.client = null
    this.reconnectTimeout = null
  }

  /**
   * Parse received values to convert them in points before sending them to the Cache
   * @param {String} pointId - The point ID
   * @param {String} dataType - The type of the received value
   * @param {Object} valueToParse - The value to parse and adapt
   * @param {String} timestamp - The ISO string date associated to the values
   * @param {Object[]} subItems - Object keys to retrieve from ADS structure
   * @param {String[]} enumInfo - Info to manage ADS enumeration
   * @returns {[{pointId, data: {value: null}, timestamp}]|null|*} - The formatted point to store in the cache
   */
  parseValues(pointId, dataType, valueToParse, timestamp, subItems, enumInfo) {
    let valueToAdd = null
    /**
     * Source of the following data types:
     * https://infosys.beckhoff.com/english.php?content=../content/1033/tcplccontrol/html/tcplcctrl_plc_data_types_overview.htm&id
     * Used by TwinCAT PLC Control
     */
    switch (dataType) {
      case 'BOOL':
        if (this.boolAsText === 'Text') {
          valueToAdd = JSON.stringify(valueToParse)
        } else {
          valueToAdd = valueToParse ? '1' : '0'
        }
        break
      case 'BYTE':
      case 'WORD':
      case 'DWORD':
      case 'SINT':
      case 'USINT':
      case 'INT':
      case 'UINT':
      case 'DINT':
      case 'UDINT':
      case 'LINT':
      case 'ULINT':
      case 'TIME': // TIME and TIME_OF_DAY are parsed as numbers
      case 'TIME_OF_DAY':
        valueToAdd = JSON.stringify(parseInt(valueToParse, 10))
        break
      case 'REAL':
      case 'LREAL':
        valueToAdd = JSON.stringify(parseFloat(valueToParse))
        break
      case 'STRING':
      case dataType.match(/^STRING\([0-9]*\)$/)?.input: // Example: STRING(35)
        valueToAdd = valueToParse
        break
      case 'DATE':
      case 'DATE_AND_TIME':
        valueToAdd = new Date(valueToParse).toISOString()
        break
      case dataType.match(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s.*$/)?.input: // Example: ARRAY [0..4] OF INT
      {
        const parsedValues = valueToParse.map((element, index) => this.parseValues(
          `${pointId}.${index}`,
          dataType.split(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s/)[1],
          element,
          timestamp,
          subItems,
          enumInfo,
        ))
        return parsedValues.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], [])
      }
      default:
        if (subItems?.length > 0) { // It is an ADS structure object (as json)
          const structure = this.structureFiltering.find((element) => element.name === dataType)
          if (structure) {
            const parsedValues = subItems.filter((item) => structure.fields === '*' || structure.fields.split(',').includes(item.name))
              .map((subItem) => this.parseValues(
                `${pointId}.${subItem.name}`,
                subItem.type,
                valueToParse[subItem.name],
                timestamp,
                subItem.subItems,
                subItem.enumInfo,
              ))
            return parsedValues.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], [])
          }
          this.logger.debug(`Data Structure ${dataType} not parsed for data ${pointId}. To parse it, please specify it in the connector settings.`)
        } else if (enumInfo?.length > 0) { // It is an ADS Enum object
          if (this.enumAsText === 'Text') {
            valueToAdd = valueToParse.name
          } else {
            valueToAdd = JSON.stringify(valueToParse.value)
          }
        } else {
          this.logger.warn(`dataType ${dataType} not supported yet for point ${pointId}. Value was ${JSON.stringify(valueToParse)}`)
        }
        break
    }
    if (valueToAdd !== null) {
      return [{
        pointId,
        timestamp,
        data: { value: valueToAdd },
      }]
    }
    return []
  }

  /**
   * Query the value of the points to read
   * @param {String} scanMode - The scan mode
   * @returns {Promise<void>} - The result promise
   */
  async lastPointQuery(scanMode) {
    const nodesToRead = this.points.filter((point) => point.scanMode === scanMode)
    if (!nodesToRead.length) {
      throw new Error(`lastPointQuery ignored: no points to read for scanMode: "${scanMode}".`)
    }

    const timestamp = new Date().toISOString()
    try {
      const results = await Promise.all(nodesToRead.map((node) => this.readAdsSymbol(node.pointId, timestamp)))
      await this.addValues(
        results.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], []),
      )
    } catch (error) {
      if (error?.message?.startsWith('Client is not connected')) {
        this.logger.error('ADS client disconnected. Reconnecting')
        await this.disconnect()
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
      } else {
        throw error
      }
    }
  }

  /**
   * @param {String} pointId - The point id to read
   * @param {String} timestamp - The ISO string date associated to the results
   * @returns {Promise<array>} - The result parsed into an array
   */
  readAdsSymbol(pointId, timestamp) {
    return new Promise((resolve, reject) => {
      this.client.readSymbol(pointId)
        .then((nodeResult) => {
          const parsedResult = this.parseValues(
            `${this.plcName}${pointId}`,
            nodeResult.symbol?.type,
            nodeResult.value,
            timestamp,
            nodeResult.type?.subItems,
            nodeResult.type?.enumInfo,
          )
          resolve(parsedResult)
        }).catch((error) => {
          reject(error)
        })
    })
  }

  /**
   * Initiates a connection to the right netId and port.
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    const options = {
      targetAmsNetId: this.netId, // example: 192.168.1.120.1.1
      targetAdsPort: this.port, // example: 851
      autoReconnect: false,
    }
    if (this.clientAmsNetId) {
      // needs to match a route declared in PLC StaticRoutes.xml file. Example: 10.211.55.2.1.1
      options.localAmsNetId = this.clientAmsNetId
    }
    if (this.clientAdsPort) {
      // should be an unused port. Example: 32750
      options.localAdsPort = this.clientAdsPort
    }
    if (this.routerAddress) {
      // distant address of the PLC. Example: 10.211.55.3
      options.routerAddress = this.routerAddress
    }
    if (this.routerTcpPort) {
      // port of the Ams router (must be open on the PLC). Example : 48898 (which is default)
      options.routerTcpPort = this.routerTcpPort
    }

    this.logger.info(`Connecting to ADS Client with options ${JSON.stringify(options)}`)
    try {
      this.client = new ads.Client(options)
      await this.connectToAdsServer()
    } catch (error) {
      this.logger.error(`ADS connect error: ${JSON.stringify(error)}`)
      await this.disconnect()
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
    }
  }

  /**
   * Connect the ADS client to the ADS server with the already provided connection options
   * @returns {Promise<void>} - The result promise
   */
  async connectToAdsServer() {
    const result = await this.client.connect()
    this.logger.info(`Connected to the ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort}`)
    await super.connect()
  }

  /**
   * Disconnect the ADS Client
   * @returns {Promise<void>} - The result promise
   */
  disconnectAdsClient() {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connection.connected) {
        resolve()
      } else {
        this.client.disconnect().then(() => resolve()).catch((error) => reject(error))
      }
    })
  }

  /**
   * Close the connection
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    if (this.connected) {
      try {
        await this.disconnectAdsClient()
      } catch (error) {
        this.logger.error('ADS disconnect error')
      }
      this.logger.info(`ADS client disconnected from ${this.netId}:${this.port}`)
    }
    this.client = null
    await super.disconnect()
  }
}
