const mqtt = require('mqtt')
const { DateTime } = require('luxon')

const SouthConnector = require('../south-connector')
const { formatValue } = require('./utils')

/**
 * Class SouthMQTT - Subscribe to data topic from a MQTT broker
 */
class SouthMQTT extends SouthConnector {
  static category = 'IoT'

  /**
   * Constructor for SouthMQTT
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      {
        supportListen: true,
        supportLastPoint: false,
        supportFile: false,
        supportHistory: false,
      },
    )

    const {
      url,
      username,
      password,
      keyFile,
      certFile,
      caFile,
      rejectUnauthorized,
      keepalive,
      reconnectPeriod,
      connectTimeout,
      qos,
      persistent,
      dataArrayPath,
      valuePath,
      pointIdPath,
      qualityPath,
      timestampOrigin,
      timestampPath,
      timestampFormat,
      timestampTimezone,
    } = configuration.settings

    this.url = url
    this.username = username
    this.password = password
    this.keyFile = keyFile
    this.certFile = certFile
    this.caFile = caFile
    this.rejectUnauthorized = rejectUnauthorized
    this.keepalive = keepalive
    this.reconnectPeriod = reconnectPeriod
    this.connectTimeout = connectTimeout
    this.qos = qos
    this.persistent = persistent
    this.dataArrayPath = dataArrayPath
    this.valuePath = valuePath
    this.pointIdPath = pointIdPath
    this.qualityPath = qualityPath
    this.timestampOrigin = timestampOrigin
    this.timestampPath = timestampPath
    this.timezone = timestampTimezone
    this.timestampFormat = timestampFormat

    // Initialized at connection
    this.client = null
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @param {Object} defaultLogParameters - The default logs parameters
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName, defaultLogParameters) {
    await super.start(baseFolder, oibusName, defaultLogParameters)
    this.clientId = `${oibusName}-${this.id}`

    if (!this.timezone || !DateTime.local().setZone(this.timezone).isValid) {
      this.logger.error(`Invalid timezone supplied: ${this.timezone}`)
      this.timezone = null
    }
    this.statusService.updateStatusDataStream({
      'Connected at': 'Not connected',
      'Last scan at': 'Subscription',
    })
  }

  /**
   * Initiate connection and start listening.
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    await super.connect()
    this.logger.info(`Connecting to "${this.url}".`)

    const options = {
      username: this.username,
      password: this.password ? Buffer.from(await this.encryptionService.decryptText(this.password)) : '',
      key: this.certificate.privateKey,
      cert: this.certificate.cert,
      ca: this.certificate.ca,
      rejectUnauthorized: this.rejectUnauthorized ? this.rejectUnauthorized : false,
      keepalive: this.keepalive,
      reconnectPeriod: this.reconnectPeriod,
      connectTimeout: this.connectTimeout,
      clientId: this.clientId,
      clean: !this.persistent,
    }
    this.client = mqtt.connect(this.url, options)
    this.client.on('connect', async () => {
      await this.listen()
      this.logger.info(`Connected to ${this.url}`)
      await super.connect()
    })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })
    this.client.on('message', async (topic, message, packet) => {
      this.logger.trace(`mqtt ${topic}:${message}, dup:${packet.dup}`)
      await this.handleMessage(topic, message)
    })
  }

  /**
   * Manage MQTT message associated to its topic
   * @param {String} topic - The topic
   * @param {Object} message - The MQTT message
   * @returns {Promise<void>} - The result promise
   */
  async handleMessage(topic, message) {
    try {
      const parsedMessage = JSON.parse(message.toString())
      const formatOptions = {
        timestampPath: this.timestampPath,
        timeOrigin: this.timestampOrigin,
        timestampFormat: this.timestampFormat,
        timezone: this.timezone,
        valuePath: this.valuePath,
        pointIdPath: this.pointIdPath,
        qualityPath: this.qualityPath,
      }

      if (this.dataArrayPath) { // if a path is set to get the data array from the message
        if (parsedMessage[this.dataArrayPath]) { // if the data array exists at this path
          const dataArray = parsedMessage[this.dataArrayPath].map((data) => {
            try {
              return formatValue(data, topic, formatOptions, this.points)
            } catch (formatError) {
              this.logger.error(formatError)
              return null
            }
          }).filter((data) => data !== null)
          // Send a formatted array of values
          if (dataArray.length > 0) {
            await this.addValues(dataArray)
          }
        } else {
          this.logger.error(`Could not find the dataArrayPath "${this.dataArrayPath}" in message "${JSON.stringify(parsedMessage)}".`)
        }
      } else { // if the message contains only one value as a json
        try {
          const formattedValue = formatValue(parsedMessage, topic, formatOptions, this.points)
          await this.addValues([formattedValue])
        } catch (formatError) {
          this.logger.error(formatError)
        }
      }
    } catch (error) {
      this.logger.error(`Could not parse message "${message}" for topic "${topic}". ${error}`)
    }
  }

  /**
   * The listen method implements the subscription for the points.
   * @returns {Promise<void>} - The result promise
   */
  async listen() {
    this.points.forEach((point) => {
      this.client.subscribe(point.topic, { qos: this.qos }, (subscriptionError) => {
        if (subscriptionError) {
          this.logger.error(`Error in subscription for topic ${point.topic}: ${subscriptionError}`)
        }
      })
    })
  }

  /**
   * Close the connection
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    if (this.client) {
      this.client.end(true)
      this.logger.info(`Disconnecting from ${this.url}...`)
    }
    await super.disconnect()
  }
}

module.exports = SouthMQTT
