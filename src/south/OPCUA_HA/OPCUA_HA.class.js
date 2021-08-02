/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
const Opcua = require('node-opcua')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 *
 *
 * @class OPCUA_HA
 * @extends {ProtocolHandler}
 */
class OPCUA_HA extends ProtocolHandler {
  /**
   * Constructor for OPCUA_HA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, { supportListen: false, supportLastPoint: false, supportFile: false, supportHistory: true })

    const { url, username, password, retryInterval, maxReadInterval, readIntervalDelay, maxReturnValues, readTimeout } = dataSource.OPCUA_HA

    this.url = url
    this.username = username
    this.password = this.encryptionService.decryptText(password)
    this.retryInterval = retryInterval // retry interval before trying to connect again
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.maxReturnValues = maxReturnValues
    this.readTimeout = readTimeout
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
   * @param {String} scanMode - the current scanmode
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
          pointId: nodesToRead[i],
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
    this.logger.silly(`read with options ${JSON.stringify(options)}`)
    const numValuesPerNode = options?.numValuesPerNode ?? 0
    let historyReadResult = []
    let nodesToRead = nodes.map((nodeId) => ({
      continuationPoint: null,
      dataEncoding: undefined,
      indexRange: undefined,
      nodeId,
    }))
    let historyReadDetails

    const dataValues = [[]]
    do {
      if (options?.aggregateFn) {
        if (!options.processingInterval) {
          this.logger.error(`option aggregageFn ${options.aggregateFn} without processingInterval`)
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
      const response = await this.session.performMessageTransaction(request)
      if (response?.responseHeader.serviceResult.isNot(Opcua.StatusCodes.Good)) {
        this.logger.error(new Error(response.responseHeader.serviceResult.toString()))
      }
      historyReadResult = response?.results
      historyReadResult?.forEach((result, i) => {
        if (!dataValues[i]) dataValues.push([])
        dataValues[i].push(...result.historyData?.dataValues ?? [])
        /**
         * @todo: need to check if throw is good enough to manage result.statusCode
         */
        if (result.statusCode.value !== 0) {
          // eslint-disable-next-line no-underscore-dangle
          this.logger.error(result.statusCode._description)
          // eslint-disable-next-line no-underscore-dangle
          throw result.statusCode._description
        }
        nodesToRead[i].continuationPoint = result.continuationPoint
      })
      // remove points fully retrieved
      nodesToRead = nodesToRead.filter((node) => !!node.continuationPoint)
      this.logger.silly(`continue read for ${nodesToRead.length} points`)
    } while (nodesToRead.length)
    // if all is retrieved, clean continatuon points
    nodesToRead = nodes.map((nodeId) => ({
      continuationPoint: null,
      dataEncoding: undefined,
      indexRange: undefined,
      nodeId,
    }))
    await this.session.performMessageTransaction(new Opcua.HistoryReadRequest({
      historyReadDetails,
      nodesToRead,
      releaseContinuationPoints: true,
      timestampsToReturn: Opcua.TimestampsToReturn.Both,
    }))
    return dataValues
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScanImplementation(scanMode) {
    const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)

    if (!scanGroup) {
      this.logger.error(`onScan ignored: no scanGroup for ${scanMode}`)
      return
    }

    if (!this.connected || this.ongoingReads[scanMode]) {
      this.logger.silly(`onScan ignored: connected: ${this.connected},ongoingReads[${scanMode}]: ${this.ongoingReads[scanMode]}`)
      return
    }

    if (!scanGroup.points || !scanGroup.points.length) {
      this.logger.error(`onScan ignored: scanGroup.points undefined or empty: ${scanGroup.points}`)
      return
    }

    this.ongoingReads[scanMode] = true

    try {
      const nodesToRead = scanGroup.points.map((point) => point)
      let opcStartTime = this.lastCompletedAt[scanMode]
      const opcEndTime = new Date()
      let intervalOpcEndTime
      let firstIteration = true
      do {
        // Wait between the read interval iterations to give time for the Cache to store the data from the previous iteration
        if (!firstIteration) {
          this.logger.silly(`Wait ${this.readIntervalDelay} ms`)
          // eslint-disable-next-line no-await-in-loop
          await this.delay(this.readIntervalDelay)
        }
        // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
        // requests (for example only one hour if maxReadInterval is 3600)
        if ((opcEndTime.getTime() - opcStartTime.getTime()) > 1000 * this.maxReadInterval) {
          intervalOpcEndTime = new Date(opcStartTime.getTime() + 1000 * this.maxReadInterval)
        } else {
          intervalOpcEndTime = opcEndTime
        }

        // eslint-disable-next-line max-len
        this.logger.silly(`Read from ${opcStartTime.getTime()} to ${intervalOpcEndTime.getTime()} (${intervalOpcEndTime - opcStartTime}ms) ${nodesToRead.length} nodes [${nodesToRead[0]}...${nodesToRead[nodesToRead.length - 1]}]`)
        const options = { timeout: this.readTimeout, numValuesPerNode: this.maxReturnValues }
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
            this.logger.error(`unsupported resampling: ${scanGroup.resampling}`)
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
            this.logger.error(`unsupported aggregage: ${scanGroup.aggregate}`)
        }

        const dataValues = await this.readHistoryValue(nodesToRead, opcStartTime, intervalOpcEndTime, options)
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
          this.logger.error(`received ${dataValues.length}, requested ${nodesToRead.length}`)
        }
        // eslint-disable-next-line no-await-in-loop
        await this.manageDataValues(dataValues, nodesToRead, opcStartTime, scanMode)

        await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
        this.logger.silly(`Updated lastCompletedAt for ${scanMode} to ${this.lastCompletedAt[scanMode]}`)

        opcStartTime = intervalOpcEndTime
        firstIteration = false
      } while (intervalOpcEndTime.getTime() !== opcEndTime.getTime())
    } catch (error) {
      this.logger.error(`on Scan ${scanMode}:${error.stack}`)
    }

    this.ongoingReads[scanMode] = false
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
    }
  }

  /**
   * Connect to OPCUA_HA server with retry.
   * @returns {Promise<void>} - The connect promise
   */
  async connectToOpcuaServer() {
    this.reconnectTimeout = null

    try {
      // define OPCUA_HA connection parameters
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1,
      }
      const options = {
        applicationName: 'OIBus',
        connectionStrategy,
        securityMode: Opcua.MessageSecurityMode.None,
        securityPolicy: Opcua.SecurityPolicy.None,
        endpoint_must_exist: false,
      }
      this.client = Opcua.OPCUAClient.create(options)
      await this.client.connect(this.url)
      let userIdentity = null
      if (this.username && this.password) {
        userIdentity = {
          type: Opcua.UserTokenType.UserName,
          userName: this.username,
          password: this.password,
        }
      }
      this.session = await this.client.createSession(userIdentity)
      this.connected = true
      this.logger.info('OPCUA_HA Connected')
    } catch (error) {
      this.logger.error(error)
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA_HA
