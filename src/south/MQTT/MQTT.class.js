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

    const { url, username, password, qos, timeStampOrigin, timeStampKey, timeStampFormat, timeStampTimezone } = this.dataSource.MQTT
    if (moment.tz.zone(timeStampTimezone)) {
      this.timezone = timeStampTimezone
    } else {
      this.logger.error(`Invalid timezone supplied: ${timeStampTimezone}`)
    }

    this.url = url
    this.username = username
    this.password = Buffer.from(this.decryptPassword(password))
    this.qos = qos
    this.timeStampOrigin = timeStampOrigin
    this.timeStampKey = timeStampKey
    this.timeStampFormat = timeStampFormat
  }

  /**
   * Initiate connection and start listening.
   * @return {void}
   */
  connect() {
    super.connect()

    this.logger.info(`Connecting to ${this.url}...`)
    const options = { username: this.username, password: this.password }
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
      this.client.subscribe(point.topic, { qos: this.qos }, (error) => {
        if (error) {
          this.logger.error(error)
        }
      })
    })

    this.client.on('message', this.handleMessageEvent.bind(this))
  }

  handleMessageEvent(topic, message, packet) {
    this.logger.silly(`mqtt ${topic}:${message}, dup:${packet.dup}`)

    try {
      const data = JSON.parse(message.toString())
      const timestamp = this.getTimestamp(data)
      const pointId = this.getPointId(topic)
      if (pointId) {
        this.addValues([{ pointId, timestamp, data }])
      } else {
        this.logger.error('PointId can\'t be determined. The value is not saved. Configuration needs to be changed')
      }
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.client.end(true)
  }

  /**
   * Get timestamp.
   * @param {object} messageObject - The message object received
   * @return {string} - The timestamp
   */
  getTimestamp(messageObject) {
    let timestamp = new Date().toISOString()

    if (this.timeStampOrigin === 'payload') {
      if (this.timezone && messageObject[this.timeStampKey]) {
        const timestampDate = MQTT.generateDateWithTimezone(messageObject[this.timeStampKey], this.timezone, this.timeStampFormat)
        timestamp = timestampDate.toISOString()
      } else {
        this.logger.error('Invalid timezone specified or the timezone key is missing in the payload')
      }
    }

    return timestamp
  }

  /**
   * Get pointId.
   * @param {string} topic - The topic
   * @return {string | null} - The pointId
   */
  getPointId(topic) {
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
    const timestampWithoutTZAsString = moment.utc(date, dateFormat).format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone)
  }
}

module.exports = MQTT
