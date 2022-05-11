const Opcua = require('node-opcua')

const { StatusCodes } = require('node-opcua')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 *
 *
 * @class OPCUA_HA
 * @extends {ProtocolHandler}
 */
class OPCUA_HA extends ProtocolHandler {
  static category = 'IoT'

  /**
   * Constructor for OPCUA_HA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {BaseEngine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })

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
    } = dataSource.OPCUA_HA

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
    this.clientName = engine.engineName
    this.keepSessionAlive = keepSessionAlive
    this.certFile = certFile
    this.keyFile = keyFile
    this.reconnectTimeout = null

    this.canHandleHistory = true
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
   * @param {Date} opcStartTime - the start time of the period
   * @param {String} scanMode - the current scanMode
   * @return {Promise<void>} The connection promise
   */
  manageDataValues = (dataValues, nodesToRead, opcStartTime, scanMode) => {
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
      values.push(...newerValues.map((value) => {
        const selectedTimestamp = value.sourceTimestamp ?? value.serverTimestamp
        const selectedTime = selectedTimestamp.getTime()
        maxTimestamp = selectedTime > maxTimestamp ? selectedTime : maxTimestamp
        return {
          pointId: nodesToRead[i].pointId,
          timestamp: selectedTimestamp.toISOString(),
          data: {
            value: value.value.value,
            quality: JSON.stringify(value.statusCode),
          },
        }
      }))
    })
    // send the packet immediately to the engine
    this.addValues(values)
    this.lastCompletedAt[scanMode] = new Date(maxTimestamp + 1)
  }

  async readHistoryValue(nodes, startTime, endTime, options) {
    this.logger.trace(`Read with options ${JSON.stringify(options)}`)
    const numValuesPerNode = options?.numValuesPerNode ?? 0
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
      if (options?.aggregateFn) {
        if (!options.processingInterval) {
          this.logger.error(`Option aggregateFn ${options.aggregateFn} without processingInterval`)
        }
        // we use the same aggregate for all nodes (OPCUA allows to have a different one for each)
        const aggregateType = Array(nodesToRead.length).fill(options.aggregateFn)
        historyReadDetails = new Opcua.ReadProcessedDetails({
          aggregateType,
          endTime,
          processingInterval: options.processingInterval,
          startTime,
        })
      } else {
        historyReadDetails = new Opcua.ReadRawModifiedDetails({
          endTime,
          isReadModified: false,
          numValuesPerNode,
          returnBounds: false,
          startTime,
        })
      }
      const request = new Opcua.HistoryReadRequest({
        historyReadDetails,
        nodesToRead,
        releaseContinuationPoints: false,
        timestampsToReturn: Opcua.TimestampsToReturn.Both,
      })
      if (options?.timeout) request.requestHeader.timeoutHint = options.timeout
      // eslint-disable-next-line no-await-in-loop
      const response = await this.session.performMessageTransaction(request)
      if (response?.responseHeader.serviceResult.isNot(Opcua.StatusCodes.Good)) {
        this.logger.error(new Error(response.responseHeader.serviceResult.toString()))
      }
      // eslint-disable-next-line no-loop-func
      response?.results?.forEach((result, i) => {
        if (!dataValues[i]) dataValues.push([])
        dataValues[i].push(...result.historyData?.dataValues ?? [])
        /**
         * Reason of statusCode not equal to zero could be there is no data for the requested data and interval
         */
        if (result.statusCode.value !== 0) {
          if (!logs[result.statusCode.value]) {
            logs[result.statusCode.value] = {
              // eslint-disable-next-line no-underscore-dangle
              description: result.statusCode._description,
              affectedNodes: [nodesToRead[i].nodeId],
            }
          } else {
            logs[result.statusCode.value].affectedNodes.push(nodesToRead[i].nodeId)
          }
        }
        nodesToRead[i].continuationPoint = result.continuationPoint
      })
      // remove points fully retrieved
      nodesToRead = nodesToRead.filter((node) => !!node.continuationPoint)
      this.logger.trace(`Continue read for ${nodesToRead.length} points`)
    } while (nodesToRead.length)
    // if all is retrieved, clean continuation points
    nodesToRead = nodes.map((node) => ({
      continuationPoint: null,
      dataEncoding: undefined,
      indexRange: undefined,
      nodeId: node.nodeId,
    }))
    await this.session.performMessageTransaction(new Opcua.HistoryReadRequest({
      historyReadDetails,
      nodesToRead,
      releaseContinuationPoints: true,
      timestampsToReturn: Opcua.TimestampsToReturn.Both,
    }))

    Object.keys(logs).forEach((statusCode) => {
      switch (statusCode) {
        case StatusCodes.BadIndexRangeNoData: // No data exists for the requested time range or event filter.
          if (logs[statusCode].affectedNodes.length > 10) {
            this.logger.debug(`${logs[statusCode].description} (${statusCode}): [${
              logs[statusCode].affectedNodes[0]}..${logs[statusCode].affectedNodes[logs[statusCode].affectedNodes.length - 1]}]`)
          } else {
            this.logger.debug(`${logs[statusCode].description} (${statusCode}): [${logs[statusCode].affectedNodes.toString()}]`)
          }

          break
        default:
          if (logs[statusCode].affectedNodes.length > 10) {
            this.logger.debug(`${logs[statusCode].description} (${statusCode}): [${
              logs[statusCode].affectedNodes[0]}..${logs[statusCode].affectedNodes[logs[statusCode].affectedNodes.length - 1]}]`)
          } else {
            this.logger.debug(`${logs[statusCode].description} (${statusCode}): [${logs[statusCode].affectedNodes.toString()}]`)
          }
          break
      }
    })
    return dataValues
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {Promise<number>} - The on scan promise: -1 if an error occurred, 0 otherwise
   */
  async historyQuery(scanMode, startTime, endTime) {
    const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)
    try {
      const nodesToRead = scanGroup.points.map((point) => point)
      // eslint-disable-next-line max-len
      this.logger.debug(`Read from ${startTime.toISOString()} to ${endTime.toISOString()} (${endTime - startTime}ms) ${nodesToRead.length} nodes [${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`)
      const options = {
        timeout: this.readTimeout,
        numValuesPerNode: this.maxReturnValues,
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
          options.aggregateFn = Opcua.AggregateFunction.Average
          break
        case 'Minimum':
          options.aggregateFn = Opcua.AggregateFunction.Minimum
          break
        case 'Maximum':
          options.aggregateFn = Opcua.AggregateFunction.Maximum
          break
        case 'Count':
          options.aggregateFn = Opcua.AggregateFunction.Count
          break
        case 'Raw':
          break
        default:
          this.logger.error(`Unsupported aggregate: ${scanGroup.aggregate}`)
      }

      const dataValues = await this.readHistoryValue(nodesToRead, startTime, endTime, options)
      /*
      Below are two example of responses
      1- With OPCUA_HA WINCC
        [
          {
            "statusCode": { "value": 0 },
            "historyData": {
              "dataValues": [
                {
                  "value": { "dataType": "Double", "arrayType": "Scalar", "value": 300},
                  "statusCode": {
                    "value": 1024
                  },
                  "sourceTimestamp": "2020-10-31T14:11:20.238Z",
                  "sourcePicoseconds": 0,
                  "serverPicoseconds": 0
                },
                {"value": { "dataType": "Double", "arrayType": "Scalar", "value": 300},
                  "statusCode": {
                    "value": 1024
                  },
                  "sourceTimestamp": "2020-10-31T14:11:21.238Z",
                  "sourcePicoseconds": 0,
                  "serverPicoseconds": 0
                }
              ]
            }
          }
        ]
        2/ With OPCUA_HA MATRIKON
        [
          {
            "statusCode": {"value": 0},
            "historyData": {
              "dataValues": [
                {
                  "value": { "dataType": "Double", "arrayType": "Scalar", "value": -0.927561841177095 },
                  "statusCode": { "value": 0 },
                  "sourceTimestamp": "2020-10-31T14:23:01.000Z",
                  "sourcePicoseconds": 0,
                  "serverTimestamp": "2020-10-31T14:23:01.000Z",
                  "serverPicoseconds": 0
                },
                {
                  "value": {"dataType": "Double", "arrayType": "Scalar","value": 0.10154855112346262},
                  "statusCode": {"value": 0},
                  "sourceTimestamp": "2020-10-31T14:23:02.000Z",
                  "sourcePicoseconds": 0,
                  "serverTimestamp": "2020-10-31T14:23:02.000Z",
                  "serverPicoseconds": 0
                }
              ]
            }
          }
        ]
      */
      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`Received ${dataValues.length} data values, requested ${nodesToRead.length} nodes`)
      }

      await this.manageDataValues(dataValues, nodesToRead, startTime, scanMode)

      await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
      this.logger.debug(`Updated lastCompletedAt for ${scanMode} to ${this.lastCompletedAt[scanMode]}`)
    } catch (error) {
      this.logger.error(`on Scan ${scanMode}:${error.stack}`)
      await this.disconnect()
      this.initializeStatusData()
      await this.connect()
      return -1
    }
    return 0
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

  /**
   * Connect to OPCUA_HA server with retry.
   * @returns {Promise<void>} - The connection promise
   */
  async connectToOpcuaServer() {
    try {
      // define OPCUA_HA connection parameters
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
          privateKey: Buffer.from(this.certificate.privateKey, 'utf-8')
            .toString(),
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
      this.logger.info('OPCUA_HA Connected')
      this.statusData['Connected at'] = new Date().toISOString()
      this.updateStatusDataStream()
    } catch (error) {
      this.logger.error(error)
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
      }
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA_HA
