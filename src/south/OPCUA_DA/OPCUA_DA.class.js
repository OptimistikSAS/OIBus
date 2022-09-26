const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  UserTokenType,
} = require('node-opcua-client')
const { OPCUACertificateManager } = require('node-opcua-certificate-manager')
const SouthConnector = require('../SouthConnector.class')
const { initOpcuaCertificateFolders } = require('../../services/opcua.service')

/**
 * Class OPCUA_DA - Connect to an OPCUA server in DA (Data Access) mode
 */
class OPCUA_DA extends SouthConnector {
  static category = 'IoT'

  /**
   * Constructor for OPCUA_DA
   * @constructor
   * @param {Object} settings - The South connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine, {
      supportListen: false,
      supportLastPoint: true,
      supportFile: false,
      supportHistory: false,
    })
    this.handlesPoints = true

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
    } = this.settings.OPCUA_DA

    this.url = url
    this.username = username
    this.password = password
    this.securityMode = securityMode
    this.securityPolicy = securityPolicy
    this.retryInterval = retryInterval
    this.clientName = settings.id
    this.keepSessionAlive = keepSessionAlive
    this.certFile = certFile
    this.keyFile = keyFile
    this.reconnectTimeout = null

    // Initialized at connection
    this.clientCertificateManager = null
    this.reconnectTimeout = null
    this.session = null
  }

  /**
   * Connect to the OPCUA server.
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    await this.session?.close() // close the session if it already exists
    await this.connectToOpcuaServer()
  }

  /**
   * Initialize services (logger, certificate, status data)
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    await super.init()
    await initOpcuaCertificateFolders(this.encryptionService.certsFolder)
    if (!this.clientCertificateManager) {
      this.clientCertificateManager = new OPCUACertificateManager({
        rootFolder: `${this.encryptionService.certsFolder}/opcua`,
        automaticallyAcceptUnknownCertificate: true,
      })
      // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
      // It is useful for offline instances of OIBus where downloading openssl is not possible
      this.clientCertificateManager.state = 2
    }
  }

  /**
   * Format values and send them to the cache
   * @param {Object[]} dataValues - The list of values
   * @param {Object[]} nodesToRead - The list of nodes
   * @returns {Promise<void>} - The result promise
   */
  formatAndSendValues = async (dataValues, nodesToRead) => {
    const values = dataValues.map((dataValue, i) => ({
      pointId: nodesToRead[i].pointId,
      timestamp: new Date().toISOString(),
      data: {
        value: dataValue.value.value,
        quality: JSON.stringify(dataValue.statusCode),
      },
    }))
    await this.addValues(values)
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - The scan mode
   * @returns {Promise<void>} - The result promise
   */
  async lastPointQuery(scanMode) {
    const nodesToRead = this.settings.points.filter((point) => point.scanMode === scanMode)
    if (!nodesToRead.length) {
      throw new Error(`No points to read for scanMode: "${scanMode}".`)
    }

    try {
      this.logger.debug(`Read ${nodesToRead.length} nodes `
          + `[${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`)

      const dataValues = await this.session.readVariableValue(nodesToRead.map((node) => node.nodeId))
      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`Received ${dataValues.length} data values, requested ${nodesToRead.length} nodes.`)
      }
      await this.formatAndSendValues(dataValues, nodesToRead)
    } catch (error) {
      await this.disconnect()
      await this.connect()
      throw error
    }
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
      await this.session?.close()
      this.session = null
    }
    await super.disconnect()
  }

  /*
  monitorPoints() {
    const nodesToMonitor = this.settings.points
      .filter((point) => point.scanMode === 'listen')
      .map((point) => point.pointId)
    if (!nodesToMonitor.length) {
      this.logger.error('Monitoring ignored: no points to monitor')
      return
    }

    this.subscription = ClientSubscription.create(this.session, {
      requestedPublishingInterval: 150,
      requestedLifetimeCount: 10 * 60 * 10,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 2,
      publishingEnabled: true,
      priority: 6,
    })
    nodesToMonitor.forEach((nodeToMonitor) => {
      const monitoredItem = ClientMonitoredItem.create(
        this.subscription,
        {
          nodeId: nodeToMonitor,
          attributeId: AttributeIds.Value,
        },
        {
          samplingInterval: 2,
          discardOldest: true,
          queueSize: 1,
        },
        TimestampsToReturn.Neither,
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
   * @returns {Promise<void>} - The result promise
   */
  async connectToOpcuaServer() {
    try {
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1,
      }
      const options = {
        applicationName: 'OIBus',
        connectionStrategy,
        securityMode: MessageSecurityMode[this.securityMode],
        securityPolicy: SecurityPolicy[this.securityPolicy],
        endpointMustExist: false,
        keepSessionAlive: this.keepSessionAlive,
        keepPendingSessionsOnDisconnect: false,
        clientName: this.clientName, // the id of the connector
        clientCertificateManager: this.clientCertificateManager,
      }

      let userIdentity
      if (this.certificate.privateKey && this.certificate.cert) {
        userIdentity = {
          type: UserTokenType.Certificate,
          certificateData: this.certificate.cert,
          privateKey: Buffer.from(this.certificate.privateKey, 'utf-8').toString(),
        }
      } else if (this.username) {
        userIdentity = {
          type: UserTokenType.UserName,
          userName: this.username,
          password: await this.encryptionService.decryptText(this.password),
        }
      } else {
        userIdentity = { type: UserTokenType.Anonymous }
      }
      this.session = await OPCUAClient.createSession(this.url, userIdentity, options)
      this.logger.info(`OPCUA_DA ${this.settings.name} connected`)
      await super.connect()
    } catch (error) {
      this.logger.error(error)
      await this.disconnect()
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA_DA
