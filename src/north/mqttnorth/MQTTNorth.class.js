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

    const { url, qos, username, password } = this.application.MQTTNorth
    this.url = url
    this.username = username
    this.password = Buffer.from(this.decryptPassword(password))
    this.qos = qos

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to MQTT North.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)
    try {
      await this.publishValues(values)
    } catch (error) {
      this.logger.error(error)
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return ApiHandler.STATUS.SUCCESS
  }

  /**
   * Connection to Broker MQTT
   * @return {void}
   */
  connect() {
    super.connect()
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
   * Makes an MQTT publish message with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async publishValues(entries) {
    entries.forEach((entry) => {
      const { pointId, data } = entry

      // The pointId string is normally structured like that
      //   xxx..xxx/yyy...yyy/.../zzz.zzz
      // In North MQTT usage we consider that the topic, to use, is given by yyy...yyy/.../zzz.zzz
      // We have to retrieve the end of the string after subtract "xxx.xxx/" string
      const topic = pointId.split('/').slice(1).join('/')

      this.client.publish(topic, JSON.stringify(data), { qos: this.qos }, (error) => {
        if (error) {
          this.logger.error('Publish Error :', topic, data, error)
        }
      })
    })
    return true
  }
}

module.exports = MQTTNorth
