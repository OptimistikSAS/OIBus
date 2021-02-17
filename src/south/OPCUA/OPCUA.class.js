const Opcua = require('node-opcua')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 *
 *
 * @class OPCUA
 * @extends {ProtocolHandler}
 */
class OPCUA extends ProtocolHandler {
  /**
   * Constructor for OPCUA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const { url, username, password, retryInterval, maxReadInterval, readIntervalDelay } = dataSource.OPCUA

    this.url = url
    this.username = username
    this.password = this.encryptionService.decryptText(password)
    this.retryInterval = retryInterval // retry interval before trying to connect again
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.lastCompletedAt = {}
    this.ongoingReads = {}
    this.reconnectTimeout = null
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    await super.connect()

    if (this.dataSource.OPCUA.scanGroups) {
      // group all points in their respective scanGroup
      // each scangroup is also initialized with a default "last completed date" equal to current Time
      this.scanGroups = this.dataSource.OPCUA.scanGroups.map((scanGroup) => {
        const points = this.dataSource.points
          .filter((point) => point.scanMode === scanGroup.scanMode)
          .map((point) => point.nodeId)
        this.lastCompletedAt[scanGroup.scanMode] = new Date().getTime()
        this.ongoingReads[scanGroup.scanMode] = false
        return {
          name: scanGroup.scanMode,
          ...scanGroup,
          points,
        }
      })
    } else {
      this.logger.error('OPCUA scanGroups are not defined. This South driver will not work')
      this.scanGroups = []
    }

    // Initialize lastCompletedAt for every scanGroup
    // "startTime" is currently a "hidden" parameter of oibus.json
    const { startTime } = this.dataSource

    const defaultLastCompletedAt = startTime ? new Date(startTime).getTime() : new Date().getTime()
    // Disable ESLint check because we need for..of loop to support async calls
    // eslint-disable-next-line no-restricted-syntax
    for (const scanGroup of Object.keys(this.lastCompletedAt)) {
      // Disable ESLint check because we want to get the values one by one to avoid parallel access to the SQLite database
      // eslint-disable-next-line no-await-in-loop
      let lastCompletedAt = await this.getConfig(`lastCompletedAt-${scanGroup}`)
      lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
      this.logger.info(`Initializing lastCompletedAt for ${scanGroup} with ${lastCompletedAt}`)
      this.lastCompletedAt[scanGroup] = lastCompletedAt
    }
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
      if (dataValue.historyData) {
        // It seems that node-opcua doesn't take into account the millisecond part when requesting historical data
        // Reading from 1583914010001 returns values with timestamp 1583914010000
        // Filter out values with timestamp smaller than startTime
        const newerValues = dataValue.historyData.dataValues.filter((value) => {
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
      } else {
        // eslint-disable-next-line no-underscore-dangle
        this.logger.error(`id:${nodesToRead[i]} error ${dataValue.statusCode._name}: ${dataValue.statusCode._description}`)
      }
    })
    // send the packet immediately to the engine
    this.addValues(values)
    this.lastCompletedAt[scanMode] = maxTimestamp + 1
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScan(scanMode) {
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
      let opcStartTime = new Date(this.lastCompletedAt[scanMode])
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

        this.logger.silly(`Read from ${opcStartTime.getTime()} to ${intervalOpcEndTime.getTime()} the nodes ${nodesToRead}`)
        // The request for the current Interval
        // eslint-disable-next-line no-await-in-loop
        const dataValues = await this.session.readHistoryValue(nodesToRead, opcStartTime, intervalOpcEndTime)
        /*
        Below are two example of responses
        1- With OPCUA WINCC
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
          2/ With OPCUA MATRIKON
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

        opcStartTime = intervalOpcEndTime
        firstIteration = false
      } while (intervalOpcEndTime.getTime() !== opcEndTime.getTime())

      await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode])
      this.logger.silly(`Updated lastCompletedAt for ${scanMode} to ${this.lastCompletedAt[scanMode]}`)
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
   * Connect to OPCUA server with retry.
   * @returns {Promise<void>} - The connect promise
   */
  async connectToOpcuaServer() {
    this.reconnectTimeout = null

    try {
      // define OPCUA connection parameters
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
      this.logger.info('OPCUA Connected')
    } catch (error) {
      this.logger.error(error)
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA
