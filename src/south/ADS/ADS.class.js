const ads = require('ads-client')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class ADS - Provides instruction for Modbus client connection
 */
class ADS extends ProtocolHandler {
  /**
   * Constructor for ADS
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)
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
    } = this.dataSource.ADS
    this.connected = false
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
  }

  parseValues(nodeId, dataType, valueToParse, timestamp, subItems, enumInfo) {
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
        valueToParse.forEach((element, index) => {
          this.parseValues(
            `${nodeId}.${index}`,
            dataType.split(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s/)[1],
            element,
            timestamp,
            subItems,
            enumInfo,
          )
        })
        break
      default:
        if (subItems?.length > 0) { // It is an ADS structure object (as json)
          const structure = this.structureFiltering.find((element) => element.name === dataType)
          if (structure) {
            subItems.filter((item) => structure.fields === '*' || structure.fields.split(',').includes(item.name)).forEach((subItem) => {
              this.parseValues(`${nodeId}.${subItem.name}`,
                subItem.type,
                valueToParse[subItem.name],
                timestamp,
                subItem.subItems,
                subItem.enumInfo)
            })
          } else {
            this.logger.debug(`Data Structure ${dataType} not parsed for data ${nodeId}. To parse it, please specify it in the connector settings.`)
          }
        } else if (enumInfo?.length > 0) { // It is an ADS Enum object
          if (this.enumAsText === 'Text') {
            valueToAdd = valueToParse.name
          } else {
            valueToAdd = JSON.stringify(valueToParse.value)
          }
        } else {
          this.logger.warn(`dataType ${dataType} not supported yet for point ${nodeId}. Value was ${JSON.stringify(valueToParse)}`)
        }
        break
    }
    if (valueToAdd !== null) {
      this.addValues([
        {
          pointId: nodeId,
          timestamp,
          data: { value: valueToAdd },
        },
      ])
    }
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScan(scanMode) {
    if (!this.connected) {
      this.logger.silly(`onScan ignored: connected: ${this.connected}`)
      return
    }

    const nodesToRead = this.dataSource.points.filter((point) => point.scanMode === scanMode)
    if (!nodesToRead.length) {
      this.logger.error(`onScan ignored: no points to read for scanMode: ${scanMode}`)
      return
    }

    await nodesToRead.forEach((node) => {
      this.client.readSymbol(node.pointId)
        .then((nodeResult) => {
          const timestamp = new Date().toISOString()
          this.parseValues(
            `${this.plcName}${node.pointId}`,
            nodeResult.symbol?.type,
            nodeResult.value,
            timestamp,
            nodeResult.type?.subItems,
            nodeResult.type?.enumInfo,
          )
        })
        .catch((error) => {
          this.logger.error(`on Scan ${scanMode}:${error.stack}`)
        })
    })
  }

  /**
   * Initiates a connection for every data source to the right netId and port.
   * @return {void}
   */
  async connect() {
    await super.connect()
    this.client = new ads.Client({
      targetAmsNetId: this.netId, // example: 192.168.1.120.1.1
      targetAdsPort: this.port, // example: 851
      localAmsNetId: this.clientAmsNetId, // needs to match a route declared in PLC StaticRoutes.xml file. Example: 10.211.55.2.1.1
      localAdsPort: this.clientAdsPort, // should be an unused port. Example: 32750
      routerAddress: this.routerAddress, // distant address of the PLC. Example: 10.211.55.3
      routerTcpPort: this.routerTcpPort, // port of the Ams router (must be open on the PLC). Example : 48898 (which is default)
    })

    await this.connectToAdsServer()
  }

  async connectToAdsServer() {
    this.reconnectTimeout = null
    try {
      const result = await this.client.connect()
      this.connected = true
      this.logger.info(`Connected to the ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort}`)
    } catch (error) {
      this.connected = false
      this.logger.error(`ADS connect error: ${JSON.stringify(error)}`)
      this.reconnectTimeout = setTimeout(this.connectToAdsServer.bind(this), this.retryInterval)
    }
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    if (this.connected) {
      this.client.disconnect()
        .finally(() => {
          this.logger.info(`ADS client disconnected from ${this.netId}:${this.port}`)
          this.connected = false
        })
    }
  }
}

module.exports = ADS
