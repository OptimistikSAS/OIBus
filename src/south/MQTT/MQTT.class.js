const mqtt = require('mqtt')
const moment = require('moment-timezone')
const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  /**
   * Initiate connection and start listening.
   * @todo: Warning: this protocol needs rework to be production ready
   * @return {void}
   */
  connect() {
    super.connect()
    this.topics = {}
    this.listen()
  }

  /**
   * Listen for messages.
   * @return {void}
   */
  listen() {
    let timezone
    const { points } = this.dataSource
    const { url, username, password, timeStampOrigin, timeStampKey, timeStampFormat, timeStampTimezone } = this.dataSource.MQTT
    if (moment.tz.zone(timeStampTimezone)) {
      timezone = timeStampTimezone
    } else {
      this.logger.error(`Invalid timezone supplied: ${timeStampTimezone}`)
    }

    this.logger.info(`Connecting to ${url}...`)
    this.client = mqtt.connect(url, { username, password: Buffer.from(this.decryptPassword(password)) })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      this.logger.info(`Connected to ${url}`)
      points.forEach((point) => {
        const { topic, pointId } = point
        this.topics[topic] = { pointId }
        this.client.subscribe(topic, { qos: 2 }, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
      })

      this.client.on('message', (topic, message, packet) => {
        this.logger.silly(`mqtt ${topic}:${message}, dup:${packet.dup}`)

        try {
          const messageObject = JSON.parse(message.toString())
          let timestamp = new Date().toISOString()
          if (timeStampOrigin === 'payload') {
            if (timezone && messageObject[timeStampKey]) {
              const timestampDate = MQTT.generateDateWithTimezone(messageObject[timeStampKey], timezone, timeStampFormat)
              timestamp = timestampDate.toISOString()
            } else {
              this.logger.error('Invalid timezone specified or the timezone key is missing in the payload')
            }
          }
          /** @todo: below should send by batch instead of single points */
          this.addValues([
            {
              // Modif Yves
              // Contournement l'absence de la prise en compte du "wildcard" # dans les topics MQTT
              // Suppression du 1er caractère du topic pour créer le pointId
              pointId: topic.slice(1),
              // pointId: this.topics[topic].pointId,
              timestamp,
              data: messageObject,
            },
          ])
        } catch (error) {
          this.logger.error(error)
        }
      })
    })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.client.end(true)
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
