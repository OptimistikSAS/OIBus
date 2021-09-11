const mqtt = require('mqtt')
const mqttWildcard = require('mqtt-wildcard')
const { vsprintf } = require('sprintf-js')
const moment = require('moment-timezone')

const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  /**
   * Constructor for MQTT
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const {
      url,
      username,
      password,
      keepalive,
      reconnectPeriod,
      connectTimeout,
      qos,
      persistent,
      clientId,
      dataArrayPath,
      valuePath,
      nodeIdPath,
      qualityPath,
      timestampOrigin,
      timestampPath,
      timestampFormat,
      timestampTimezone,
    } = this.dataSource.MQTT

    if (moment.tz.zone(timestampTimezone)) {
      this.timezone = timestampTimezone
    } else {
      this.logger.error(`Invalid timezone supplied: ${timestampTimezone}`)
    }

    this.url = url
    this.username = username
    this.password = Buffer.from(this.encryptionService.decryptText(password))
    this.keepalive = keepalive
    this.reconnectPeriod = reconnectPeriod
    this.connectTimeout = connectTimeout
    this.qos = qos
    this.persistent = persistent
    this.clientId = clientId || `OIBus-${Math.random().toString(16).substr(2, 8)}`
    this.dataArrayPath = dataArrayPath
    this.valuePath = valuePath
    this.nodeIdPath = nodeIdPath
    this.qualityPath = qualityPath
    this.timestampOrigin = timestampOrigin
    this.timestampPath = timestampPath
    this.timestampFormat = timestampFormat

    this.handlesPoints = true
  }

  /**
   * Initiate connection and start listening.
   * @return {void}
   */
  async connect() {
    await super.connect()

    this.logger.info(`Connecting to ${this.url}...`)
    const options = {
      username: this.username,
      password: this.password,
      keepalive: this.keepalive,
      reconnectPeriod: this.reconnectPeriod,
      connectTimeout: this.connectTimeout,
      clientId: this.clientId,
      clean: !this.persistent,
    }
    this.client = mqtt.connect(this.url, options)
    this.client.on('error', this.handleConnectError.bind(this))
    this.client.on('connect', this.handleConnectEvent.bind(this))
  }

  /**
   * Handle connection error event.
   * @param {object} error - The error
   * @return {void}
   */
  handleConnectError(error) {
    this.logger.error(error)
  }

  /**
   * Handle successful connection event.
   * @return {void}
   */
  handleConnectEvent() {
    this.logger.info(`Connected to ${this.url}`)

    this.dataSource.points.forEach((point) => {
      this.client.subscribe(point.topic, { qos: this.qos }, this.subscribeCallback.bind(this, point))
    })

    this.client.on('message', this.handleMessageEvent.bind(this))
  }

  /**
   * Callback to handle subscription.
   * @param {object} point - the point being subscribed
   * @param {object} error - The error
   * @param {array} _granted - not used
   * @return {void}
   */
  subscribeCallback(point, error, _granted) {
    if (error) {
      this.logger.error(`Error in subscription for topic ${point.topic}`)
      this.logger.error(error)
    }
  }

  /**
   *
   * @param {object} data - the data to format
   * @param {string} topic - the mqtt topic
   * @returns {{pointId: string, data: {value: *, quality: *}, timestamp: string}|null} - the formatted data
   */
  formatValue(data, topic) {
    const dataNodeId = this.getPointId(topic, data)
    if (dataNodeId) {
      const dataTimestamp = this.getTimestamp(data[this.timeStampPath])
      const dataValue = data[this.valuePath]
      const dataQuality = data[this.qualityPath]
      delete data[this.timeStampPath] // delete fields to avoid duplicates in the returned object
      delete data[this.valuePath]
      delete data[this.nodeIdPath]
      delete data[this.qualityPath]
      return {
        pointId: dataNodeId,
        timestamp: dataTimestamp,
        data: {
          ...data,
          value: dataValue,
          quality: dataQuality,
        },
      }
    }
    this.logger.error(`PointId cant be determined. The followingvalue ${JSON.stringify(data)} is not saved. Configuration needs to be changed`)
    return null
  }

  handleMessageEvent(topic, message, packet) {
    this.logger.silly(`mqtt ${topic}:${message}, dup:${packet.dup}`)

    try {
      const parsedMessage = JSON.parse(message.toString())
      if (this.dataArrayPath) { // if a path is set to get the data array from the message
        if (parsedMessage[this.dataArrayPath]) { // if the data array exists at this path
          const dataArray = parsedMessage[this.dataArrayPath].map((data) => this.formatValue(data, topic))
          this.addValues(dataArray) // send a formatted array of values
        } else {
          this.logger.error(`Could not find the dataArrayPath ${JSON.stringify(this.dataArrayPath)} in message ${JSON.stringify(parsedMessage)}`)
        }
      } else { // if the message contains only one value as a json
        this.addValues([this.formatValue(parsedMessage, topic)])
      }
    } catch (error) {
      this.logger.error(`could not parse message ${message} for topic ${topic} ${error.stack}`)
    }
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.client.end(true)
    super.disconnect()
  }

  /**
   * Get timestamp.
   * @param {string} elementTimestamp - The element timestamp
   * @return {string} - The timestamp
   */
  getTimestamp(elementTimestamp) {
    let timestamp = new Date().toISOString()

    if (this.timeStampOrigin === 'payload') {
      if (this.timezone && elementTimestamp) {
        timestamp = MQTT.generateDateWithTimezone(elementTimestamp, this.timezone, this.timeStampFormat)
      } else {
        this.logger.error('Invalid timezone specified or the timestamp key is missing in the payload')
      }
    }

    return timestamp
  }

  /**
   * Get pointId.
   * @param {string} topic - The topic
   * @param {object} currentData - The data being parsed
   * @return {string | null} - The pointId
   */
  getPointId(topic, currentData) {
    if (this.nodeIdPath) { // if the nodeId is in the data
      if (!currentData[this.nodeIdPath]) {
        this.logger.error(`Could node find nodeId in path ${this.nodeIdPath} for data: ${JSON.stringify(currentData)}`)
        return null
      }
      return currentData[this.nodeIdPath]
    } // else, the pointId is in the topic
    let pointId = null
    const matchedPoints = []

    this.dataSource.points.forEach((point) => {
      const matchList = mqttWildcard(topic, point.topic)
      if (Array.isArray(matchList)) {
        if (!pointId) {
          const nrWildcards = (point.pointId.match(/[+#]/g) || []).length
          if (nrWildcards === matchList.length) {
            const normalizedPointId = point.pointId.replace(/[+#]/g, '%s')
            pointId = vsprintf(normalizedPointId, matchList)
            matchedPoints.push(point)
          } else {
            this.logger.error(`Invalid point configuration: ${JSON.stringify(point)}`)
          }
        } else {
          matchedPoints.push(point)
        }
      }
    })

    if (matchedPoints.length > 1) {
      this.logger.error(`${topic} should be subscribed only once but it has the following subscriptions: ${JSON.stringify(matchedPoints)}`)
      pointId = null
    }

    return pointId
  }

  /**
   * Generate date based on the configured format taking into account the timezone configuration.
   * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
   * @param {string} date - The date to parse and format
   * @param {string} timezone - The timezone to use to replace the timezone of the date
   * @param {string} dateFormat - The format of the date
   * @returns {string} - The formatted date with timezone
   */
  static generateDateWithTimezone(date, timezone, dateFormat) {
    const timestampWithoutTZAsString = moment.utc(date, dateFormat)
      .format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone)
      .toISOString()
  }
}

module.exports = MQTT
