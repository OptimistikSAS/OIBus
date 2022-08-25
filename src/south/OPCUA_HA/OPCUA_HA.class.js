const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  TimestampsToReturn,
  StatusCodes,
  UserTokenType,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  HistoryReadRequest,
  AggregateFunction,
} = require('node-opcua-client')
const { OPCUACertificateManager } = require('node-opcua-certificate-manager')

const SouthConnector = require('../SouthConnector.class')
const { initOpcuaCertificateFolders, MAX_NUMBER_OF_NODE_TO_LOG } = require('../../services/opcua.service')

/**
 * Class OPCUA_HA - Connect to an OPCUA server in HA (Historian Access) mode
 */
class OPCUA_HA extends SouthConnector {
  static category = 'IoT'

  /**
   * Constructor for OPCUA_HA
   * @constructor
   * @param {Object} settings - The South connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })
    this.canHandleHistory = true
    this.handlesPoints = true

    const {
      url,
      username,
      password,
      retryInterval,
      maxReadInterval,
      readIntervalDelay,
      maxReturnValues,
      readTimeout,
      securityMode,
      securityPolicy,
      keepSessionAlive,
      certFile,
      keyFile,
    } = this.settings.OPCUA_HA

    this.url = url
    this.username = username
    this.password = password
    this.retryInterval = retryInterval
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.maxReturnValues = maxReturnValues
    this.readTimeout = readTimeout
    this.securityMode = securityMode
    this.securityPolicy = securityPolicy
    this.clientName = settings.id
    this.keepSessionAlive = keepSessionAlive
    this.certFile = certFile
    this.keyFile = keyFile

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
   * @param {Date} opcStartTime - The start time of the period
   * @param {String} scanMode - The current scanMode
   * @return {Promise<void>} The resolved promise
   */
  formatAndSendValues = async (dataValues, nodesToRead, opcStartTime, scanMode) => {
    const values = []
    let maxTimestamp = opcStartTime.getTime()
    dataValues.forEach((dataValue, i) => {
      // It seems that node-opcua doesn't take into account the millisecond part when requesting historical data
      // Reading from 1583914010001 returns values with timestamp 1583914010000
      // Filter out values with timestamp smaller than startTime
      const newerValues = dataValue.filter((value) => {
        const selectedTimestamp = value.sourceTimestamp ?? value.serverTimestamp
        return selectedTimestamp.getTime() >= opcStartTime.getTime()
      })
      if (newerValues.length < dataValue.length) {
        this.logger.debug(`Received ${newerValues.length} new values for ${nodesToRead[i].pointId} among ${dataValue.length} values retrieved.`)
      }
      values.push(...newerValues.map((opcuaValue) => {
        const selectedTimestamp = opcuaValue.sourceTimestamp ?? opcuaValue.serverTimestamp
        const selectedTime = selectedTimestamp.getTime()
        maxTimestamp = selectedTime > maxTimestamp ? selectedTime : maxTimestamp
        return {
          pointId: nodesToRead[i].pointId,
          timestamp: selectedTimestamp.toISOString(),
          data: {
            value: opcuaValue.value.value,
            quality: JSON.stringify(opcuaValue.statusCode),
          },
        }
      }))
    })
    if (values.length > 0) {
      await this.addValues(values)
      this.lastCompletedAt[scanMode] = new Date(maxTimestamp + 1)
      this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
      this.logger.debug(`Updated lastCompletedAt for "${scanMode}" to ${this.lastCompletedAt[scanMode].toISOString()}.`)
    } else {
      this.logger.debug(`No value retrieved for "${scanMode}".`)
    }
  }

  /**
   * Send a read query to the OPCUA server for a list of nodes
   *
   *       Below are two example of responses
   *       1- With OPCUA_HA WINCC
   *         [
   *           {
   *             "statusCode": { "value": 0 },
   *             "historyData": {
   *               "dataValues": [
   *                 {
   *                   "value": { "dataType": "Double", "arrayType": "Scalar", "value": 300},
   *                   "statusCode": {
   *                     "value": 1024
   *                   },
   *                   "sourceTimestamp": "2020-10-31T14:11:20.238Z",
   *                   "sourcePicoseconds": 0,
   *                   "serverPicoseconds": 0
   *                 },
   *                 {"value": { "dataType": "Double", "arrayType": "Scalar", "value": 300},
   *                   "statusCode": {
   *                     "value": 1024
   *                   },
   *                   "sourceTimestamp": "2020-10-31T14:11:21.238Z",
   *                   "sourcePicoseconds": 0,
   *                   "serverPicoseconds": 0
   *                 }
   *               ]
   *             }
   *           }
   *         ]
   *         2/ With OPCUA_HA MATRIKON
   *         [
   *           {
   *             "statusCode": {"value": 0},
   *             "historyData": {
   *               "dataValues": [
   *                 {
   *                   "value": { "dataType": "Double", "arrayType": "Scalar", "value": -0.927561841177095 },
   *                   "statusCode": { "value": 0 },
   *                   "sourceTimestamp": "2020-10-31T14:23:01.000Z",
   *                   "sourcePicoseconds": 0,
   *                   "serverTimestamp": "2020-10-31T14:23:01.000Z",
   *                   "serverPicoseconds": 0
   *                 },
   *                 {
   *                   "value": {"dataType": "Double", "arrayType": "Scalar","value": 0.10154855112346262},
   *                   "statusCode": {"value": 0},
   *                   "sourceTimestamp": "2020-10-31T14:23:02.000Z",
   *                   "sourcePicoseconds": 0,
   *                   "serverTimestamp": "2020-10-31T14:23:02.000Z",
   *                   "serverPicoseconds": 0
   *                 }
   *               ]
   *             }
   *           }
   *         ]
   *
   * @param {Object[]} nodes - The nodes to read on the OPCUA server
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @param {Object} options - The read options
   * @returns {Promise<[][]>} - The list of values for each node
   */
  async readHistoryValue(nodes, startTime, endTime, options) {
    this.logger.trace(`Reading ${nodes.length} with options "${JSON.stringify(options)}".`)
    let nodesToRead = nodes.map((node) => ({
      continuationPoint: null,
      dataEncoding: undefined,
      indexRange: undefined,
      nodeId: node.nodeId,
    }))
    let historyReadDetails

    const logs = {}
    const dataValues = [[]]
    do {
      if (options.aggregateFn) {
        if (!options.processingInterval) {
          this.logger.error(`Option aggregateFn ${options.aggregateFn} without processingInterval.`)
        }
        // We use the same aggregate for all nodes (OPCUA allows to have a different one for each)
        const aggregateType = Array(nodesToRead.length).fill(options.aggregateFn)
        historyReadDetails = new ReadProcessedDetails({
          startTime,
          endTime,
          aggregateType,
          processingInterval: options.processingInterval,
        })
      } else {
        historyReadDetails = new ReadRawModifiedDetails({
          startTime,
          endTime,
          numValuesPerNode: options.numValuesPerNode,
          isReadModified: false,
          returnBounds: false,
        })
      }
      const request = new HistoryReadRequest({
        historyReadDetails,
        nodesToRead,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both,
      })
      if (options.timeout) request.requestHeader.timeoutHint = options.timeout

      // eslint-disable-next-line no-await-in-loop
      const response = await this.session.performMessageTransaction(request)
      if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
        this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`)
      }

      if (response.results) {
        this.logger.debug(`Received a response of ${response.results.length} nodes.`)
        nodesToRead = nodesToRead.map((node, i) => {
          if (!dataValues[i]) dataValues.push([])
          const result = response.results[i]
          this.logger.trace(`Result for node "${node.nodeId}" (number ${i}) contains `
              + `${result.historyData?.dataValues.length} values and has status code `
              + `${JSON.stringify(result.statusCode.value)}, continuation point is ${result.continuationPoint}.`)
          dataValues[i].push(...result.historyData?.dataValues ?? [])

          // Reason of statusCode not equal to zero could be there is no data for the requested data and interval
          if (result.statusCode.value !== StatusCodes.Good) {
            if (!logs[result.statusCode.value]) {
              logs[result.statusCode.value] = {
                description: result.statusCode.description,
                affectedNodes: [node.nodeId],
              }
            } else {
              logs[result.statusCode.value].affectedNodes.push(node.nodeId)
            }
          }
          return {
            ...node,
            continuationPoint: result.continuationPoint,
          }
        })
          .filter((node) => !!node.continuationPoint)
        this.logger.trace(`Continue read for ${nodesToRead.length} points.`)
      } else {
        this.logger.error('No result found in response.')
      }
    } while (nodesToRead.length)

    // If all is retrieved, clean continuation points
    nodesToRead = nodes.map((node) => ({
      continuationPoint: null,
      dataEncoding: undefined,
      indexRange: undefined,
      nodeId: node.nodeId,
    }))
    const response = await this.session.performMessageTransaction(new HistoryReadRequest({
      historyReadDetails,
      nodesToRead,
      releaseContinuationPoints: true,
      timestampsToReturn: TimestampsToReturn.Both,
    }))

    if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
      this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`)
    }

    Object.keys(logs).forEach((statusCode) => {
      switch (statusCode) {
        case StatusCodes.BadIndexRangeNoData: // No data exists for the requested time range or event filter.
        default:
          if (logs[statusCode].affectedNodes.length > MAX_NUMBER_OF_NODE_TO_LOG) {
            this.logger.debug(`${logs[statusCode].description} (${statusCode}): [${
              logs[statusCode].affectedNodes[0]}..${logs[statusCode].affectedNodes[logs[statusCode].affectedNodes.length - 1]}]`)
          } else {
            this.logger.debug(`${logs[statusCode].description} with status code ${statusCode}: [${logs[statusCode].affectedNodes.toString()}]`)
          }
          break
      }
    })
    return dataValues
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async historyQuery(scanMode, startTime, endTime) {
    const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)
    try {
      const nodesToRead = scanGroup.points.map((point) => point)
      this.logger.debug(`Read from ${startTime.toISOString()} to ${endTime.toISOString()} `
              + `(${endTime - startTime}ms) ${nodesToRead.length} nodes `
              + `[${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`)
      const options = {
        timeout: this.readTimeout,
        numValuesPerNode: this.maxReturnValues ?? 0,
      }
      switch (scanGroup.resampling) {
        case 'Second':
          options.processingInterval = 1000
          break
        case '10 Seconds':
          options.processingInterval = 1000 * 10
          break
        case '30 Seconds':
          options.processingInterval = 1000 * 30
          break
        case 'Minute':
          options.processingInterval = 1000 * 60
          break
        case 'Hour':
          options.processingInterval = 1000 * 3600
          break
        case 'Day':
          options.processingInterval = 1000 * 3600 * 24
          break
        case 'None':
          break
        default:
          this.logger.error(`Unsupported resampling: ${scanGroup.resampling}`)
      }
      switch (scanGroup.aggregate) {
        case 'Average':
          options.aggregateFn = AggregateFunction.Average
          break
        case 'Minimum':
          options.aggregateFn = AggregateFunction.Minimum
          break
        case 'Maximum':
          options.aggregateFn = AggregateFunction.Maximum
          break
        case 'Count':
          options.aggregateFn = AggregateFunction.Count
          break
        case 'Raw':
          break
        default:
          this.logger.error(`Unsupported aggregate: ${scanGroup.aggregate}`)
      }

      const dataValues = await this.readHistoryValue(nodesToRead, startTime, endTime, options)

      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`Received ${dataValues.length} data values, requested ${nodesToRead.length} nodes.`)
      }

      await this.formatAndSendValues(dataValues, nodesToRead, startTime, scanMode)
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

  /**
   * Connect to OPCUA_HA server with retry.
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
          password: this.encryptionService.decryptText(this.password),
        }
      } else {
        userIdentity = { type: UserTokenType.Anonymous }
      }
      this.session = await OPCUAClient.createSession(this.url, userIdentity, options)
      this.logger.info(`OPCUA_HA ${this.settings.name} connected`)
      await super.connect()
    } catch (error) {
      this.logger.error(error)
      await this.disconnect()
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA_HA
