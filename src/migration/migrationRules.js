const fs = require('fs')
const Logger = require('../engine/Logger.class')

const logger = new Logger('migration')

module.exports = {
  2: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'RawFile') {
        logger.info('Rename RawFile to FolderScanner')
        dataSource.protocol = 'FolderScanner'
        if (Object.prototype.hasOwnProperty.call(dataSource, 'RawFile')) {
          dataSource.FolderScanner = dataSource.RawFile
          delete dataSource.RawFile
        }
      }

      if (dataSource.protocol === 'SQLFile') {
        logger.info('Rename SQLFile to SQLDbToFile')
        dataSource.protocol = 'SQLDbToFile'
        if (Object.prototype.hasOwnProperty.call(dataSource, 'SQLFile')) {
          dataSource.SQLDbToFile = dataSource.SQLFile
          delete dataSource.SQLFile
        }
      }
    })

    config.north.applications.forEach((application) => {
      if (application.api === 'Link') {
        logger.info('Rename Link to OIConnect')
        application.api = 'OIConnect'
        if (Object.prototype.hasOwnProperty.call(application, 'Link')) {
          application.OIConnect = application.Link
          delete application.Link
        }
      }

      if (application.api === 'RawFileSender') {
        logger.info('Rename RawFileSender to OIAnalyticsFile')
        application.api = 'OIAnalyticsFile'
        if (Object.prototype.hasOwnProperty.call(application, 'RawFileSender')) {
          application.OIAnalyticsFile = application.RawFileSender
          delete application.RawFileSender
        }
      }
    })

    logger.info('Move protocol dependent parameters under a sub object of the protocol')
    const engineRelatedDataSourceFields = ['dataSourceId', 'enabled', 'protocol', 'scanMode', 'points', 'scanGroups']
    config.south.dataSources.forEach((dataSource) => {
      if (!Object.prototype.hasOwnProperty.call(dataSource, dataSource.protocol)) {
        const dataSourceRelatedFields = {}
        Object.entries(dataSource).forEach(([key, value]) => {
          if (!engineRelatedDataSourceFields.includes(key)) {
            dataSourceRelatedFields[key] = value
            delete dataSource[key]
          }
        })
        dataSource[dataSource.protocol] = dataSourceRelatedFields
      }
    })

    logger.info('Move api dependent parameters under a sub object of the api')
    const engineRelatedApplicationFields = ['applicationId', 'enabled', 'api', 'caching', 'subscribedTo']
    config.north.applications.forEach((application) => {
      if (!Object.prototype.hasOwnProperty.call(application, application.api)) {
        const applicationRelatedFields = {}
        Object.entries(application).forEach(([key, value]) => {
          if (!engineRelatedApplicationFields.includes(key)) {
            applicationRelatedFields[key] = value
            delete application[key]
          }
        })
        application[application.api] = applicationRelatedFields
      }
    })
  },
  3: (config) => {
    config.engine.engineName = 'OIBus'
    logger.info('Add engineName: OIBus')
    const { sqliteFilename } = config.engine.logParameters
    if (fs.existsSync(sqliteFilename)) {
      logger.info('Rename SQLite log file')
      fs.renameSync(sqliteFilename, `${sqliteFilename}.old`)
    }
  },
  4: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCHDA') {
        logger.info('Add maxReturnValues and maxReadInterval to OPCHDA')
        dataSource.OPCHDA.maxReturnValues = 10000
        dataSource.OPCHDA.maxReadInterval = 3600
      }
    })
  },
  5: (config) => {
    config.north.applications.forEach((application) => {
      if (application.api === 'OIConnect') {
        logger.info('Set timeout for OIConnect')
        application.OIConnect.timeout = 180000
      }
      if (application.protocol === 'OIAnalyticsFile') {
        logger.info('Set timeout for OIAnalyticsFile')
        application.OIAnalyticsFile.timeout = 180000
      }
    })
  },
  6: (config) => {
    const defaultConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
    const aliveSignalConfig = defaultConfig.engine.aliveSignal

    const aliveSignalIds = []
    config.north.applications.forEach((application) => {
      if (application.api === 'AliveSignal') {
        if (aliveSignalIds.length === 0) {
          logger.info('There is an AliveSignal api configured. Saving its config')
          const host = new URL(application.AliveSignal.host)
          aliveSignalConfig.enabled = application.enabled
          aliveSignalConfig.host = host.origin
          aliveSignalConfig.endpoint = host.pathname
          aliveSignalConfig.authentication.type = application.AliveSignal.authentication.type
          aliveSignalConfig.authentication.username = application.AliveSignal.authentication.username
          aliveSignalConfig.authentication.password = application.AliveSignal.authentication.password
          aliveSignalConfig.id = application.AliveSignal.id
          aliveSignalConfig.frequency = application.AliveSignal.frequency
          aliveSignalConfig.proxy = application.AliveSignal.proxy
        }
        aliveSignalIds.push(application.applicationId)
      }
    })
    logger.info(`Remove AliveSignal apis: ${aliveSignalIds.toString()}`)
    config.north.applications = config.north.applications.filter((application) => !aliveSignalIds.includes(application.applicationId))

    logger.info('Add aliveSignal to engine config')
    config.engine.aliveSignal = aliveSignalConfig
  },
  7: (config) => {
    let stack = 'fetch'
    let timeout = 30

    config.north.applications.forEach((application) => {
      if (['OIConnect', 'OIAnalyticsFile'].includes(application.api)) {
        logger.info(`Remove HTTP stack related settings from ${application.applicationId}`)

        stack = application[application.api].stack ? application[application.api].stack : stack
        timeout = application[application.api].timeout ? application[application.api].timeout / 1000 : timeout

        delete application[application.api].stack
        delete application[application.api].timeout
      }
    })

    logger.info('Add settings for the HTTP request (stack, timeout)')
    config.engine.httpRequest = {
      stack,
      timeout,
    }
  },
  8: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'FolderScanner') {
        if (Object.prototype.hasOwnProperty.call(dataSource.FolderScanner, 'preserveFiles')) {
          logger.info('Rename preserveFiles to preserve for FolderScanner')
          dataSource.FolderScanner.preserve = dataSource.FolderScanner.preserveFiles
          delete dataSource.FolderScanner.preserveFiles
        }
      }
    })
  },
  9: (config) => {
    logger.info('Add retry count setting for the HTTP request')
    config.engine.httpRequest.retryCount = 3
  },
  10: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'SQLDbToFile') {
        logger.info('Add encryption field to SQLDbToFile')
        dataSource.SQLDbToFile.encryption = true
      }
    })
  },
  11: (config) => {
    logger.info('Add verbose mode for AliveSignal')
    config.engine.aliveSignal.verbose = false
  },
  12: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'MQTT') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'qos')) {
          logger.info('Add qos field to MQTT')
          dataSource.MQTT.qos = 1
        }
      }
    })
    config.north.applications.forEach((application) => {
      if (application.api === 'MQTTNorth') {
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'qos')) {
          logger.info('Add qos field to MQTTNorth')
          application.MQTTNorth.qos = 1
        }
      }
    })
  },
  13: (config) => {
    config.north.applications.forEach((application) => {
      if (application.api === 'MQTTNorth') {
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'regExp')) {
          logger.info('Add regExp field to MQTTNorth')
          application.MQTTNorth.regExp = '(.*)/'
        }
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'topic')) {
          logger.info('Add topic field to MQTTNorth')
          application.MQTTNorth.topic = '%1$s'
        }
      }
    })
  },
  14: (config) => {
    config.north.applications.forEach((application) => {
      if (application.api === 'OIConnect') {
        if (Object.prototype.hasOwnProperty.call(application.OIConnect, 'endpoint')) {
          logger.info('Separate OIConnect endpoints for values and file')
          application.OIConnect.valuesEndpoint = application.OIConnect.endpoint
          application.OIConnect.fileEndpoint = '/engine/addFile'
          delete application.OIConnect.endpoint
        }
      }
    })
  },
  15: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'FolderScanner') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.FolderScanner, 'compress')) {
          logger.info('Add compress field to FolderScanner')
          dataSource.FolderScanner.compress = false
        }
      }
    })
  },
  16: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'SQLDbToFile') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'compress')) {
          logger.info('Add compress field to SQLDbToFile')
          dataSource.SQLDbToFile.compress = false
        }
      }
    })
  },
  17: (config) => {
    config.north.applications.forEach((application) => {
      if (application.api === 'OIAnalyticsFile') {
        logger.info('Rename OIAnalyticsFile to OIAnalytics')
        application.api = 'OIAnalytics'
        if (Object.prototype.hasOwnProperty.call(application, 'OIAnalyticsFile')) {
          delete application.OIAnalyticsFile.endpoint
          application.OIAnalytics = application.OIAnalyticsFile
          delete application.OIAnalyticsFile
        }
      }
    })
  },
  18: (config) => {
    logger.info('Remove listen scan mode')
    config.engine.scanModes = config.engine.scanModes.filter((scanMode) => scanMode.cronTime !== 'listen')
  },
  19: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCUA') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCUA, 'readIntervalDelay')) {
          logger.info('Add readIntervalDelay field to OPCUA')
          dataSource.OPCUA.readIntervalDelay = 200
        }
      }
      if (dataSource.protocol === 'MQTT') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'persistent')) {
          logger.info('Add persistent field to MQTT')
          dataSource.MQTT.persistent = false
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'clientId')) {
          logger.info('Add clientId field to MQTT')
          dataSource.MQTT.clientId = `OIBus-${Math.random().toString(16).substr(2, 8)}`
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'keepalive')) {
          logger.info('Add keepalive field to MQTT')
          dataSource.MQTT.keepalive = 60000
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'reconnectPeriod')) {
          logger.info('Add reconnectPeriod field to MQTT')
          dataSource.MQTT.reconnectPeriod = 1000
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'connectTimeout')) {
          logger.info('Add connectTimeout field to MQTT')
          dataSource.MQTT.connectTimeout = 30000
        }
      }
    })
  },
  20: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCUA') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCUA, 'maxReturnValues')) {
          logger.info('Add maxReturnValues field to OPCUA')
          dataSource.OPCUA.maxReturnValues = 1000
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCUA, 'readTimeout')) {
          logger.info('Add readTimeout field to OPCUA')
          dataSource.OPCUA.readTimeout = 180000
        }
      }
    })
  },
  21: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCUA') {
        logger.info('Rename OPCUA to OPCUA_HA')
        dataSource.protocol = 'OPCUA_HA'
        if (Object.prototype.hasOwnProperty.call(dataSource, 'OPCUA')) {
          dataSource.OPCUA_HA = dataSource.OPCUA
          delete dataSource.OPCUA
        }
      }
    })
  },
  22: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'Modbus') {
        const modbusTypes = {
          1: 'coil',
          2: 'discreteInput',
          3: 'inputRegister',
          4: 'holdingRegister',
        }
        dataSource.points?.forEach((point) => {
          if (!Object.prototype.hasOwnProperty.call(point, 'modbusType')) {
            point.modbusType = modbusTypes[point.address.charAt(0)]
            point.address = `0x${point.address.slice(1)}`
          }
          if (!Object.prototype.hasOwnProperty.call(point, 'dataType')) {
            logger.info('Add dataType field to Modbus points')
            point.dataType = 'UInt16'
          }
          if (!Object.prototype.hasOwnProperty.call(point, 'multiplierCoefficient')) {
            logger.info('Add multiplierCoefficient field to Modbus points')
            point.multiplierCoefficient = 1
          }
        })
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'slaveId')) {
          logger.info('Add slaveId field to Modbus')
          dataSource.Modbus.slaveId = 1
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'adressOffset')) {
          logger.info('Add addressOffset field to Modbus')
          dataSource.Modbus.addressOffset = 'Modbus'
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'endianness')) {
          logger.info('Add endianness field to Modbus')
          dataSource.Modbus.endianness = 'Big Endian'
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'swapBytesinWords')) {
          logger.info('Add swapBytesinWords field to Modbus')
          dataSource.Modbus.swapBytesinWords = false
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'swapWordsInDWords')) {
          logger.info('Add swapWordsInDWords field to Modbus')
          dataSource.Modbus.swapWordsInDWords = false
        }
        if (!Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'retryInterval')) {
          logger.info('Add retryInterval field to Modbus')
          dataSource.Modbus.retryInterval = 10000
        }
      }
    })
  },
  23: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'FolderScanner') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.FolderScanner, 'ignoreModifiedDate')) {
          logger.info('Add ignoreModifiedDate field to FolderScanner')
          dataSource.FolderScanner.ignoreModifiedDate = false
        }
        if (Object.prototype.hasOwnProperty.call(dataSource.FolderScanner, 'preserve')) {
          logger.info('Rename preserve field into preserveFiles in FolderScanner')
          dataSource.FolderScanner.preserveFiles = dataSource.FolderScanner.preserve
          delete dataSource.FolderScanner.preserve
        }
      }
    })
  },
  24: (config) => {
    const newLogParameters = {
      consoleLog: { level: config.engine.logParameters.consoleLevel },
      fileLog: {
        level: config.engine.logParameters.fileLevel,
        fileName: config.engine.logParameters.filename,
        maxSize: config.engine.logParameters.maxsize,
        numberOfFiles: config.engine.logParameters.maxFiles,
        tailable: config.engine.logParameters.tailable,
      },
      sqliteLog: {
        level: config.engine.logParameters.sqliteLevel,
        fileName: config.engine.logParameters.sqliteFilename,
        maxSize: config.engine.logParameters.sqliteMaxFileSize,
      },
      lokiLog: {
        level: 'none',
        host: '',
        interval: 60,
        identifier: 'oibus',
      },
    }
    config.engine.logParameters = newLogParameters
  },
}
