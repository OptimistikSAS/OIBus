const mqtt = require('mqtt')
global.NorthHandler = require('../NorthHandler.class')

/**
 * Expected caching parameters:
 * Send Interval (ms): [1000, 3000]
 * Retry Interval (ms): 5000
 * Group count : 10000
 * Max Group Count : 10000
 * with the condition: Group Count <= Max Group Count
 */

/**
 * Class WATSYConnect - generates and sends MQTT messages for WATSY
 * The MQTT message sent will have the format:
 * {
      'timestamp' : $timestamp in ns
      'tags'    : {
          'tag1'  : $tag_value_1
          'tag2'  : $tag_value_2
          ...
      }
      'fields'    : {
          'field1'  : $field_value_1
          'field2'  : $field_value_2
          ...
      }
      'host'      : $host (can't be null)
      'token'     : $token (can't be null)
  }
 */

class WATSYConnect extends NorthHandler {
  static category = 'API'

  /**
   * Constructor for WATSYConnect
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { MQTTUrl, port, username, password, applicativeHostUrl, secretKey } = this.application.WATSYConnect
    this.url = MQTTUrl
    this.port = port
    this.username = username
    this.password = password
    this.qos = 1
    this.host = applicativeHostUrl
    this.token = this.encryptionService.decryptText(secretKey)

    this.splitMessageTimeout = this.application.caching.sendInterval // in ms
    this.OIBUSName = this.engine.configService.getConfig().engineConfig.engineName
    this.initMQTTTopic()

    this.successCount = 0

    this.canHandleValues = true
  }

  /**
   * Init the Mqqt Topic from
   * @return {void}
   */
  initMQTTTopic() {
    // Declare local var which will be used to construct the topic
    let mqttTopic
    let regex = /^https?:\/\// // clean $host in mqtt topic construction
    let regexHost = this.host.replace(regex, '')
    regex = /.com$|.fr$/
    regexHost = regexHost.replace(regex, '')

    // Construct the topic
    mqttTopic = `data/${regexHost}/${this.OIBUSName}`
    // Replace all . by _ in the topic
    mqttTopic = mqttTopic.split('.').join('_')
    mqttTopic = mqttTopic.split('-').join('_')
    this.mqttTopic = mqttTopic
  }

  /**
   * Connection to Broker MQTT
   * @param {string} _additionalInfo - connection information to display in the logger
   * @return {void}
   */
  connect(_additionalInfo = '') {
    this.logger.info(`Connecting WATSYConnect ${this.application.name} to ${this.url}...`)
    this.client = mqtt.connect(this.url, { port: this.port, username: this.username, password: this.encryptionService.decryptText(this.password) })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      super.connect(`url: ${this.url}`)
    })
  }

  /**
   * Disconnection from WATSYConnect
   * @return {void}
   */
  async disconnect() {
    this.client.end(true)
    this.statusData['Connected at'] = 'Not connected'
    this.updateStatusDataStream()
    await super.disconnect()
  }

  /**
   * Handle messages by sending them to WATSYConnect North.
   * @param {object[]} messages - The messages
   * @return {Promise} - The handle status
   */
  async handleValues(messages) {
    this.logger.trace(`Link handleValues() call with ${messages.length} messages`)
    const successCount = await this.publishOIBusMessages(messages)
    if (successCount === 0) {
      throw NorthHandler.STATUS.COMMUNICATION_ERROR
    }
    this.statusData['Last handled values at'] = new Date().toISOString()
    this.statusData['Number of values sent since OIBus has started'] += messages.length
    this.statusData['Last added point id (value)'] = `${messages[messages.length - 1].pointId} (${messages[messages.length - 1].data.value})`
    this.updateStatusDataStream()
    return successCount
  }

  /**
   * Makes an MQTT publish message with the parameters in the Object arg.
   * @param {Object[]} messages - The message from the event
   * @returns {Promise} - The request status
   */
  async publishOIBusMessages(messages) {
    // Intit succesCount to 0 when we handle new messages
    this.successCount = 0

    try {
      if (messages.length > 0) {
        const allWATSYMessages = this.splitMessages(messages)
        allWATSYMessages.forEach((message) => {
          this.publishWATSYMQTTMessage(message)
        })
      }
    } catch (error) {
      this.logger.error(error)
    }

    return this.successCount
  }

  /**
   * Publish MQTT message.
   *
   * @param {object} message - The message to publish
   * @returns {Promise} - The publish status
   */
  publishWATSYMQTTMessage(message) {
    return new Promise((resolve, reject) => {
      this.client.publish(this.mqttTopic, JSON.stringify(message), { qos: this.qos }, (error) => {
        if (error) {
          this.logger.error(error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Convert the message into WATSY format
   *
   * @param {object[]} messages - The message to publish
   * @return {object[]} - The publish value
   */
  splitMessages(messages) {
    return this.recursiveSplitMessages([], messages)
  }

  /**
   * Convert the message into WATSY format
   * @param {Object[]} allWATSYMessages - All messages which will be returned
   * @param {object[]} messages - The message to publish
   * @return {object[]} - The publish value
   */
  recursiveSplitMessages(allWATSYMessages, messages) {
    // Check if messages is not null
    if (messages.length > 1) {
      // Declare all local var for the split logic
      const splitTimestamp = Date.parse(messages[messages.length - 1].timestamp)

      let i = messages.length - 1

      while (i > 0) {
        // Check if the the message is in the splitTimestamp delta time

        if (Date.parse(messages[i].timestamp) < splitTimestamp - this.splitMessageTimeout) {
          // Get all the message which are not in less than splitTImestamp than the last message
          const splitMessage = messages.slice(0, i + 1)

          // Add the message which respect the splitTimestamp
          const allWATSYMessagesVar = this.recursiveSplitMessages(allWATSYMessages, splitMessage)

          const pushMessages = messages.filter((x) => !splitMessage.includes(x))
          allWATSYMessagesVar.push(this.convertIntoWATSYFormat(pushMessages))

          this.successCount += pushMessages.length
          return allWATSYMessagesVar
        }
        i -= 1
      }

      // All the message are in the sendMessage Interval ([1, 3] sec)
      allWATSYMessages.push(this.convertIntoWATSYFormat(messages))
      this.successCount += messages.length
      return allWATSYMessages
    }
    // End of the recursive function
    if (messages.length === 1) {
      allWATSYMessages.push(this.convertIntoWATSYFormat(messages))
      this.successCount += 1
    }
    return allWATSYMessages
  }

  /**
   * Convert the message into WATSY format
   *
   * @param {object[]} message - The message to publish
   * @return {Object} - The publish status
   */
  convertIntoWATSYFormat(message) {
    const tagsVar = {}
    const fieldsVar = {}

    // Construct fields and tags choosing the latest state for each PointId
    for (let i = message.length - 1; i >= 0; i -= 1) {
      // Add the current fields (datpointID) if it's not in JSON fields
      if (!Object.prototype.hasOwnProperty.call(fieldsVar, message[i].pointId)) {
        fieldsVar[message[i].pointId] = message[i].data.value
      }
    }

    // TODO: Add all tags

    return {
      timestamp: Date.parse(message[message.length - 1].timestamp) * 1000 * 1000, // from ms to ns
      tags: tagsVar,
      fields: fieldsVar,
      host: this.host,
      token: this.token,
    }
  }
}

module.exports = WATSYConnect
