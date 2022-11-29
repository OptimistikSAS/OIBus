import { vsprintf } from 'sprintf-js'
import mqtt from 'mqtt'
import objectPath from 'object-path'

import NorthConnector from '../north-connector.js'

/**
 * Class NorthMQTT - Publish data to a MQTT broker
 */
export default class NorthMQTT extends NorthConnector {
  static category = 'IoT'

  /**
   * Constructor for NorthMQTT
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {Object[]} proxies - The list of available proxies
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
    logger,
  ) {
    super(
      configuration,
      proxies,
      logger,
    )
    this.canHandleValues = true

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
    } = configuration.settings
    this.url = url
    this.qos = qos
    this.username = username
    this.password = password
    this.keyFile = keyFile
    this.certFile = certFile
    this.caFile = caFile
    this.rejectUnauthorized = rejectUnauthorized
    this.regExp = regExp
    this.topic = topic
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

    // Initialized at connection
    this.client = null
    this.clientId = null
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName) {
    await super.start(baseFolder, oibusName)
    this.clientId = `${oibusName}-${this.id}`
  }

  /**
   * Connection to a MQTT broker
   * @param {String} _additionalInfo - Connection information to display in the logger
   * @returns {Promise<void>} - The result promise
   */
  async connect(_additionalInfo = '') {
    this.logger.info(`Connecting North "${this.name}" to "${this.url}".`)

    const options = {
      username: this.username,
      password: this.password ? Buffer.from(await this.encryptionService.decryptText(this.password)) : '',
      clientId: this.clientId,
      key: this.certificate.privateKey,
      cert: this.certificate.cert,
      ca: this.certificate.ca,
      rejectUnauthorized: this.rejectUnauthorized ? this.rejectUnauthorized : false,
    }
    this.client = mqtt.connect(this.url, options)

    this.client.on('connect', this.onConnect)
    this.client.on('error', this.onError)
  }

  /**
   * Called on 'connect' event for MQTT client
   * @returns {Promise<void>} - The result promise
   */
  async onConnect() {
    await super.connect(`url: "${this.url}"`)
  }

  /**
   * @param {String} error - The error to log
   * Called on 'error' event for MQTT client
   * @returns {Promise<void>} - The result promise
   */
  async onError(error) {
    this.logger.error(error)
  }

  /**
   * Handle values by sending them to the MQTT broker.
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)
    await Promise.all(values.map((value) => this.publishValue(value)))
  }

  /**
   * Disconnection from MQTT Broker
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.logger.info(`Disconnecting North "${this.name}" from "${this.url}".`)
    this.client.end(true)
    await super.disconnect()
  }

  /**
   * Publish MQTT message.
   * @param {Object} value - The value to publish
   * @returns {Promise<void>} - The result promise
   */
  publishValue(value) {
    return new Promise((resolve, reject) => {
      const { pointId, data } = value

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const topicValue = vsprintf(this.topic, groups)

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters.
      // In fact, as some use cases can produce value structured as JSON objects, values which could be atomic values
      // (integer, float, ...) or JSON object must be processed
      let dataValue
      if (this.useDataKeyValue) {
        // The data to use is the key "value" of a JSON object data (data.value)
        // This data.value can be a JSON object or an atomic value (i.e. integer or float or string, ...)
        // If it's a JSON, the function return a data where the path is given by keyParentValue parameter even if the
        // JSON object contains more than one level of object.
        // For example: data = { value: { "level1": { "level2": { value: ..., timestamp:... } } } }
        // In this context :
        //   - the object to use, containing value and timestamp, is localised in data.value object by keyParentValue
        // level1.level2
        //   - To retrieve this object, we use objectPath with parameters: (data.value, 'level1.level2')
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // Data to use is the JSON object data
        dataValue = data
      }

      this.client.publish(
        topicValue,
        JSON.stringify(dataValue),
        { qos: this.qos },
        (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        },
      )
    })
  }
}
