const { vsprintf } = require('sprintf-js')
const mqtt = require('mqtt')
const objectPath = require('object-path')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class MQTT - generates and sends MQTT messages
 */
class MQTTNorth extends ApiHandler {
  static category = 'IoT'

  /**
   * Constructor for MQTT
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const {
      url,
      qos,
      username,
      password,
      keyFile,
      certFile,
      caFile,
      rejectUnauthorized,
      regExp,
      topic,
      useDataKeyValue,
      keyParentValue,
    } = this.application.MQTTNorth

    this.url = url
    this.qos = qos
    this.clientId = `${engine.engineName}-${this.application.id}`
    this.username = username
    this.password = Buffer.from(this.encryptionService.decryptText(password))
    this.keyFile = keyFile
    this.certFile = certFile
    this.caFile = caFile
    this.rejectUnauthorized = rejectUnauthorized
    this.regExp = regExp
    this.topic = topic
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to MQTT North.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`MQTT North handleValues() call with ${values.length} values`)
    const successCount = await this.publishValues(values)
    if (successCount === 0) {
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    this.statusData['Last handled values at'] = new Date().toISOString()
    this.statusData['Number of values sent since OIBus has started'] += values.length
    this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
    this.updateStatusDataStream()
    return successCount
  }

  /**
   * Connection to Broker MQTT
   * @return {void}
   */
  async connect() {
    super.connect()
    this.logger.info(`Connecting North MQTT Connector to ${this.url}...`)

    const options = {
      username: this.username,
      password: this.password,
      clientId: this.clientId,
      key: this.certificate.privateKey,
      cert: this.certificate.cert,
      ca: this.certificate.ca,
      rejectUnauthorized: this.rejectUnauthorized ? this.rejectUnauthorized : false,
    }
    this.client = mqtt.connect(this.url, options)

    this.client.on('connect', this.handleConnectEvent.bind(this))
    this.client.on('error', this.handleConnectError.bind(this))
  }

  /**
   * Handle successful connection event.
   * @return {void}
   */
  handleConnectEvent() {
    this.logger.info(`North MQTT Connector connected to ${this.url}`)
    this.statusData['Connected at'] = new Date().toISOString()
    this.updateStatusDataStream()
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
   * Disconnection from MQTT Broker
   * @return {void}
   */
  disconnect() {
    this.logger.info(`Disconnecting North MQTT Connector from ${this.url}`)
    this.client.end(true)
    this.statusData['Connected at'] = 'Not connected'
    this.updateStatusDataStream()
    super.disconnect()
  }

  /**
   * Publish MQTT message.
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

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters
      let dataValue
      if (this.useDataKeyValue) {
        // data to use is value key of Json object data (data.value)
        // this data.value could be a Json object or simple value (i.e. integer or float or string, ...)
        // If it's a json the function return data where "address" is given by keyParentValue parameter
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // data to use is Json object data
        dataValue = data
      }

      this.client.publish(topicValue, JSON.stringify(dataValue), { qos: this.qos }, (error) => {
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
