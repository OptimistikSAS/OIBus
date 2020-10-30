const { vsprintf } = require('sprintf-js')
const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class MQTT - generates and sends MQTT messages
 */
class MQTTNorth extends ApiHandler {
  /**
   * Constructor for MQTT
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { url, qos, username, password, regExp, topic } = this.application.MQTTNorth

    this.url = url
    this.username = username
    this.password = Buffer.from(this.decryptPassword(password))
    this.qos = qos
    this.regExp = regExp
    this.topic = topic

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to MQTT North.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)
    const successCount = await this.publishValues(values)
    if (successCount === 0) {
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return successCount
  }

  /**
   * Connection to Broker MQTT
   * @return {void}
   */
  async connect() {
    await super.connect()
    this.logger.info(`Connecting North MQTT Connector to ${this.url}...`)
    this.client = mqtt.connect(this.url, { username: this.username, password: this.password })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      this.logger.info(`Connection North MQTT Connector to ${this.url}`)
    })
  }

  /**
   * Disconnection from MQTT Broker
   * @return {void}
   */
  disconnect() {
    this.logger.info(`Disconnecting North MQTT Connector from ${this.url}`)
    this.client.end(true)
  }

  /**
   * Publish MQTT message.
   *
   * @param {object} entry - The entry to publish
   * @returns {Promise} - The publish status
   */
  publishValue(entry) {
    return new Promise((resolve, reject) => {
      const { pointId, data } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const topicValue = vsprintf(this.topic, groups)

      this.client.publish(topicValue, JSON.stringify(data), { qos: this.qos }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Makes an MQTT publish message with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async publishValues(entries) {
    let successCount = 0
    try {
      // Disable ESLint check because we need for..of loop to support async calls
      // eslint-disable-next-line no-restricted-syntax
      for (const entry of entries) {
        // Disable ESLint check because we want to publish values one by one
        // eslint-disable-next-line no-await-in-loop
        await this.publishValue(entry)
        successCount += 1
      }
    } catch (error) {
      this.logger.error(error)
    }

    return successCount
  }
}

module.exports = MQTTNorth
