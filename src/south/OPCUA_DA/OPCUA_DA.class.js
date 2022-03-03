const Opcua = require('node-opcua')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 *
 *
 * @class OPCUA_DA
 * @extends {ProtocolHandler}
 */
class OPCUA_DA extends ProtocolHandler {
  static category = 'IoT'

  /**
   * Constructor for OPCUA_DA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, { supportListen: false, supportLastPoint: true, supportFile: false, supportHistory: false })

    const {
      url,
      username,
      password,
      retryInterval,
      securityMode,
      securityPolicy,
      keepSessionAlive,
      certFile,
      keyFile,
    } = dataSource.OPCUA_DA

    this.url = url
    this.username = username
    this.password = password
    this.securityMode = securityMode
    this.securityPolicy = securityPolicy
    this.retryInterval = retryInterval
    this.clientName = engine.engineName
    this.keepSessionAlive = keepSessionAlive
    this.certFile = certFile
    this.keyFile = keyFile
    this.reconnectTimeout = null

    this.handlesPoints = true
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    await super.connect()
    await this.connectToOpcuaServer()
  }

  /**
   * manageDataValues
   * @param {array} dataValues - the list of values
   * @param {Array} nodesToRead - the list of nodes
   * @return {Promise<void>} The connection promise
   */
  manageDataValues = (dataValues, nodesToRead) => {
    const values = []
    dataValues.forEach((dataValue, i) => {
      values.push({
        pointId: nodesToRead[i],
        timestamp: new Date().toISOString(),
        data: {
          value: dataValue.value.value,
          quality: JSON.stringify(dataValue.statusCode),
        },
      })
    })
    this.addValues(values)
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async lastPointQuery(scanMode) {
    if (!this.connected) {
      this.logger.trace(`onScan ignored: connected: ${this.connected}`)
      return
    }

    const nodesToRead = this.dataSource.points
      .filter((point) => point.scanMode === scanMode)
      .map((point) => point.pointId)
    if (!nodesToRead.length) {
      this.logger.error(`onScan ignored: no points to read for scanMode: ${scanMode}`)
      return
    }

    try {
      const dataValues = await this.session.readVariableValue(nodesToRead)
      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`received ${dataValues.length}, requested ${nodesToRead.length}`)
      }
      await this.manageDataValues(dataValues, nodesToRead)
    } catch (error) {
      this.logger.error(`on Scan ${scanMode}:${error.stack}`)
    }
  }

  /**
   * Close the connection
   * @return {void}
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.connected) {
      await this.session.close()
      await this.client.disconnect()
      this.connected = false
      this.statusData['Connected at'] = 'Not connected'
      this.updateStatusDataStream()
    }
    super.disconnect()
  }

  /*
  monitorPoints() {
    const nodesToMonitor = this.dataSource.points
      .filter((point) => point.scanMode === 'listen')
      .map((point) => point.pointId)
    if (!nodesToMonitor.length) {
      this.logger.error('Monitoring ignored: no points to monitor')
      return
    }

    this.subscription = Opcua.ClientSubscription.create(this.session, {
      requestedPublishingInterval: 150,
      requestedLifetimeCount: 10 * 60 * 10,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 2,
      publishingEnabled: true,
      priority: 6,
    })
    nodesToMonitor.forEach((nodeToMonitor) => {
      const monitoredItem = Opcua.ClientMonitoredItem.create(
        this.subscription,
        {
          nodeId: nodeToMonitor,
          attributeId: Opcua.AttributeIds.Value,
        },
        {
          samplingInterval: 2,
          discardOldest: true,
          queueSize: 1,
        },
        Opcua.TimestampsToReturn.Neither,
      )

      monitoredItem.on('changed', (dataValue) => this.manageDataValues([dataValue], nodesToMonitor))
    })

    // On disconnect()
    if (this.subscription) {
      await this.subscription.terminate()
    }
  }
   */

  /**
   * Connect to OPCUA_DA server with retry.
   * @returns {Promise<void>} - The connect promise
   */
  async connectToOpcuaServer() {
    this.reconnectTimeout = null

    try {
      // define OPCUA_DA connection parameters
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1,
      }
      const options = {
        applicationName: this.clientName,
        connectionStrategy,
        securityMode: Opcua.MessageSecurityMode[this.securityMode],
        securityPolicy: Opcua.SecurityPolicy[this.securityPolicy],
        endpointMustExist: false,
        keepSessionAlive: this.keepSessionAlive,
        clientName: this.clientName,
      }
      this.client = Opcua.OPCUAClient.create(options)
      await this.client.connect(this.url)
      let userIdentity = null
      if (this.certificate.privateKey && this.certificate.cert) {
        userIdentity = {
          type: Opcua.UserTokenType.Certificate,
          certificateData: this.certificate.cert,
          privateKey: Buffer.from(this.certificate.privateKey, 'utf-8').toString(),
        }
      } else if (this.username) {
        userIdentity = {
          type: Opcua.UserTokenType.UserName,
          userName: this.username,
          password: this.encryptionService.decryptText(this.password),
        }
      }
      this.session = await this.client.createSession(userIdentity)
      this.connected = true
      this.logger.info('OPCUA_DA Connected')
      this.statusData['Connected at'] = new Date().toISOString()
      this.updateStatusDataStream()
    } catch (error) {
      this.logger.error(error)
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA_DA
