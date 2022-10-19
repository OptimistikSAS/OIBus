/* eslint-disable no-restricted-syntax, no-await-in-loop */

const fs = require('node:fs/promises')
const path = require('node:path')
const db = require('better-sqlite3')
const { nanoid } = require('nanoid')
const databaseMigrationService = require('./database.migration.service')
const databaseService = require('../services/database.service')
const { createFolder } = require('../services/utils')

module.exports = {
  2: (config, logger) => {
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
        Object.entries(dataSource)
          .forEach(([key, value]) => {
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
        Object.entries(application)
          .forEach(([key, value]) => {
            if (!engineRelatedApplicationFields.includes(key)) {
              applicationRelatedFields[key] = value
              delete application[key]
            }
          })
        application[application.api] = applicationRelatedFields
      }
    })
  },
  3: async (config, logger) => {
    config.engine.engineName = 'OIBus'
    logger.info('Add engineName: OIBus')
    const { sqliteFilename } = config.engine.logParameters
    let sqliteFileExists = false
    try {
      await fs.access(sqliteFilename)
      sqliteFileExists = true
    } catch {
      logger.info(`No sqlite file ${sqliteFilename} to migrate`)
    }
    if (sqliteFileExists) {
      logger.info('Rename SQLite log file')
      await fs.rename(sqliteFilename, `${sqliteFilename}.old`)
    }
  },
  4: (config, logger) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCHDA') {
        logger.info('Add maxReturnValues and maxReadInterval to OPCHDA')
        dataSource.OPCHDA.maxReturnValues = 10000
        dataSource.OPCHDA.maxReadInterval = 3600
      }
    })
  },
  5: (config, logger) => {
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
  6: (config, logger) => {
    const aliveSignalConfig = {
      enabled: false,
      host: '',
      endpoint: '/api/optimistik/oibus/info',
      authentication: {
        type: 'Basic',
        username: '',
        password: '',
      },
      id: '',
      frequency: 300,
      proxy: '',
    }

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
  7: (config, logger) => {
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
  8: (config, logger) => {
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
  9: (config, logger) => {
    logger.info('Add retry count setting for the HTTP request')
    config.engine.httpRequest.retryCount = 3
  },
  10: (config, logger) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'SQLDbToFile') {
        logger.info('Add encryption field to SQLDbToFile')
        dataSource.SQLDbToFile.encryption = true
      }
    })
  },
  11: (config, logger) => {
    logger.info('Add verbose mode for AliveSignal')
    config.engine.aliveSignal.verbose = false
  },
  12: (config, logger) => {
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
  13: (config, logger) => {
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
  14: (config, logger) => {
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
  15: (config, logger) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'FolderScanner') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.FolderScanner, 'compress')) {
          logger.info('Add compress field to FolderScanner')
          dataSource.FolderScanner.compress = false
        }
      }
    })
  },
  16: (config, logger) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'SQLDbToFile') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'compress')) {
          logger.info('Add compress field to SQLDbToFile')
          dataSource.SQLDbToFile.compress = false
        }
      }
    })
  },
  17: (config, logger) => {
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
  18: (config, logger) => {
    logger.info('Remove listen scan mode')
    config.engine.scanModes = config.engine.scanModes.filter((scanMode) => scanMode.cronTime !== 'listen')
  },
  19: (config, logger) => {
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
          dataSource.MQTT.clientId = `OIBus-${Math.random()
            .toString(16)
            .slice(2, 8)}`
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
  20: (config, logger) => {
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
  21: (config, logger) => {
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
  22: (config, logger) => {
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
  23: (config, logger) => {
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
  24: async (config, logger) => {
    logger.info('Migrating logParameters and adding lokiLog')
    config.engine.logParameters = {
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
        maxNumberOfLogs: 1000000,
      },
      lokiLog: {
        level: 'none',
        lokiAddress: '',
        interval: 60,
        username: '',
        password: '',
        tokenAddress: '',
      },
    }
    if (config.engine.logParameters.consoleLog.level === 'silly') {
      config.engine.logParameters.consoleLog.level = 'trace'
    }
    if (config.engine.logParameters.fileLog.level === 'silly') {
      config.engine.logParameters.fileLog.level = 'trace'
    }
    if (config.engine.logParameters.sqliteLog.level === 'silly') {
      config.engine.logParameters.sqliteLog.level = 'trace'
    }

    const logDatabase = config.engine.logParameters.sqliteLog.fileName
    try {
      await fs.access(logDatabase)
      await databaseMigrationService.addColumn(logDatabase, 'logs', 'scope')
    } catch {
      logger.info(`No log db file to migrate (file name: ${logDatabase})`)
    }

    if (typeof config.engine.safeMode === 'undefined') {
      logger.info('Adding safeMode field (false) to the config')
      config.engine.safeMode = false
    }

    logger.info('Migrating alive signal to health signal')
    config.engine.healthSignal = {
      logging: {
        enabled: true,
        frequency: 3600,
      },
      http: {
        enabled: config.engine.aliveSignal.enabled,
        host: config.engine.aliveSignal.host || 'http://localhost',
        endpoint: config.engine.aliveSignal.endpoint,
        authentication: config.engine.aliveSignal.authentication,
        frequency: config.engine.aliveSignal.frequency,
        proxy: config.engine.aliveSignal.proxy || '',
        verbose: config.engine.aliveSignal.verbose || false,
      },
    }
    delete config.engine.aliveSignal

    logger.info('Adding advanced cache features in engine config')
    config.engine.caching.bufferMax = 250
    config.engine.caching.bufferTimeoutInterval = 300

    logger.info('Migrating archive cache settings')
    config.engine.caching.archive = {
      enabled: config.engine.caching.archiveMode === 'archive',
      archiveFolder: config.engine.caching.archiveFolder || './cache/archive/',
      retentionDuration: 0,
    }
    delete config.engine.caching.archiveMode
    delete config.engine.caching.archiveFolder

    config.engine.historyQuery = { folder: './historyQuery' }

    // Remove empty external sources
    config.engine.externalSources = config.engine.externalSources?.filter((externalSource) => externalSource !== '') || []

    for (const dataSource of config.south.dataSources) {
      logger.info(`Fixing log parameters for data source ${dataSource.dataSourceId}`)
      if (!dataSource.logParameters) {
        dataSource.logParameters = {
          consoleLevel: 'engine',
          fileLevel: 'engine',
          sqliteLevel: 'engine',
          lokiLevel: 'engine',
        }
      } else if (!dataSource.logParameters.lokiLevel) {
        dataSource.logParameters.lokiLevel = 'engine'
      }
      if (dataSource.logParameters.consoleLevel === 'silly') {
        dataSource.logParameters.consoleLevel = 'trace'
      }
      if (dataSource.logParameters.fileLevel === 'silly') {
        dataSource.logParameters.fileLevel = 'trace'
      }
      if (dataSource.logParameters.sqliteLevel === 'silly') {
        dataSource.logParameters.sqliteLevel = 'trace'
      }

      if (Object.prototype.hasOwnProperty.call(dataSource, 'enable')) {
        if (!Object.prototype.hasOwnProperty.call(dataSource, 'enabled')) {
          dataSource.enabled = dataSource.enable
        }
        delete dataSource.enable
      }

      if (dataSource.protocol === 'FolderScanner') {
        logger.info(`Fixing Folder Scanner settings for data source ${dataSource.dataSourceId}`)

        // Case where a connector has been created but never set
        if (!dataSource.FolderScanner) {
          dataSource.FolderScanner = {
            minAge: 1000,
            compression: false,
            inputFolder: './input/',
            regex: '.*',
            ignoreModifiedDate: false,
            preserveFiles: false,
          }
        }

        if (!dataSource.scanMode && !dataSource.points) {
          logger.info(`Filling Folder Scanner scanMode for data source ${dataSource.dataSourceId} with last engine scanMode`)
          dataSource.scanMode = config.engine.scanModes[config.engine.scanModes.length - 1].scanMode
        } else if (!dataSource.scanMode && dataSource.points?.length > 0) {
          logger.info(`Filling Folder Scanner scanMode for data source ${dataSource.dataSourceId} with first point scanMode`)
          dataSource.scanMode = dataSource.points[0].scanMode
        }
        dataSource.points = []

        // a previous migration forgot to update the compression parameter (called "compress" before)
        if (typeof dataSource.FolderScanner.compression === 'undefined') {
          if (typeof dataSource.FolderScanner.compress !== 'undefined') {
            dataSource.FolderScanner.compression = dataSource.FolderScanner.compress
            delete dataSource.FolderScanner.compress
          } else {
            dataSource.FolderScanner.compression = false
          }
        }
        if (!dataSource.FolderScanner.inputFolder) {
          dataSource.FolderScanner.inputFolder = './input/'
        }
      }
      if (dataSource.protocol === 'SQLDbToFile') {
        logger.info(`Fixing SQL settings for data source ${dataSource.dataSourceId}`)
        // Case where a connector has been created but never set
        if (!dataSource.SQLDbToFile) {
          dataSource.SQLDbToFile = {
            port: 1433,
            password: '',
            encryption: false,
            connectionTimeout: 1000,
            requestTimeout: 1000,
            compression: false,
            maxReadInterval: 0,
            readIntervalDelay: 200,
            driver: 'sqlite',
            databasePath: './database.db',
            host: 'localhost',
            database: 'db',
            username: 'a',
            domain: '',
            query: '',
            delimiter: ',',
            dateFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            filename: 'sql-@CurrentDate-@QueryPart.csv',
            timeColumn: 'timestamp',
            timezone: 'Europe/Paris',
          }
        }

        // when the driver sqlite was added to SQLDbToFile, the databasePath was forgotten in the migration, causing the
        // config to change (adding the databasePath default value) after an update when the user visit a SQLDbToFile
        // connector page
        if (typeof dataSource.SQLDbToFile.databasePath === 'undefined') {
          dataSource.SQLDbToFile.databasePath = './sqlite.db'
        }

        if (Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'dateFormat')) {
          logger.info('Update date format from moment to luxon for SQLDbToFile')
          dataSource.SQLDbToFile.dateFormat = dataSource.SQLDbToFile.dateFormat.replace('YYYY', 'yyyy')
            .replace('DD', 'dd')
        }

        if (!Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'maxReadInterval')) {
          logger.info('Add maxReadInterval')
          dataSource.SQLDbToFile.maxReadInterval = 0
        }

        if (!Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'readIntervalDelay')) {
          logger.info('Add readIntervalDelay')
          dataSource.SQLDbToFile.readIntervalDelay = 200
        }
        if (Object.prototype.hasOwnProperty.call(dataSource.SQLDbToFile, 'filename')) {
          logger.info('Update @date to @CurrentDate in file name')
          dataSource.SQLDbToFile.filename = dataSource.SQLDbToFile.filename.replace('@date', '@CurrentDate')
        }

        logger.info(`Rename @LastCompletedAt to @StartTime in the query for ${dataSource.name}`)
        dataSource.SQLDbToFile.query = dataSource.SQLDbToFile.query.replace(/@LastCompletedDate/g, '@StartTime')

        dataSource.points = []

        logger.info(`Changing SQLDbToFile type to SQL for ${dataSource.name}`)
        dataSource.SQL = dataSource.SQLDbToFile
        delete dataSource.SQLDbToFile
        dataSource.protocol = 'SQL'
      }
      if (dataSource.protocol === 'MQTT') {
        logger.info(`Fixing MQTT settings for data source ${dataSource.dataSourceId}`)

        // Case where a connector has been created but never set
        if (!dataSource.MQTT) {
          dataSource.MQTT = {
            persistent: false,
            password: '',
            rejectUnauthorized: false,
            keepalive: 60000,
            reconnectPeriod: 1000,
            connectTimeout: 30000,
            url: '',
            qos: 1,
            username: '',
            certFile: '',
            keyFile: '',
            caFile: '',
            dataArrayPath: '',
            valuePath: 'value',
            pointIdPath: '',
            qualityPath: 'quality',
            timestampOrigin: 'oibus',
            timestampPath: 'timestamp',
            timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            timestampTimezone: 'Europe/Paris',
          }
        }

        dataSource.MQTT.timestampOrigin = dataSource.MQTT.timeStampOrigin
        delete dataSource.MQTT.timeStampOrigin
        dataSource.MQTT.timestampFormat = dataSource.MQTT.timeStampFormat
        delete dataSource.MQTT.timeStampFormat
        dataSource.MQTT.timestampTimezone = dataSource.MQTT.timeStampTimezone
        delete dataSource.MQTT.timeStampTimezone
        dataSource.MQTT.pointIdPath = dataSource.MQTT.nodeIdPath
        delete dataSource.MQTT.nodeIdPath

        if (Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'timestampFormat')) {
          logger.info('Update date format from moment to luxon for MQTT')
          dataSource.MQTT.timestampFormat = dataSource.MQTT.timestampFormat.replace('YYYY', 'yyyy')
            .replace('DD', 'dd')
        }

        // engine name is used instead
        if (dataSource.MQTT.clientId) {
          delete dataSource.MQTT.clientId
        }

        if (!Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'certificate')) {
          logger.info(`Add certificate fields to MQTT settings for data source ${dataSource.dataSourceId}`)
          dataSource.MQTT.certFile = ''
          dataSource.MQTT.keyFile = ''
          dataSource.MQTT.caFile = ''
          dataSource.MQTT.rejectUnauthorized = false
        }

        if (Object.prototype.hasOwnProperty.call(dataSource.MQTT, 'timestampFormat')) {
          logger.info('Update date format from moment to luxon for MQTT')
          dataSource.MQTT.timestampFormat = dataSource.MQTT.timestampFormat.replace('YYYY', 'yyyy')
            .replace('DD', 'dd')
        }
      }
      if (dataSource.protocol === 'OPCUA_HA') {
        logger.info(`Add OPCUA_HA security fields for data source ${dataSource.dataSourceId}`)

        // Case where a connector has been created but never set
        if (!dataSource.OPCUA_HA) {
          dataSource.OPCUA_HA = {
            keepSessionAlive: false,
            retryInterval: 10000,
            maxReadInterval: 3600,
            readIntervalDelay: 200,
            maxReturnValues: 1000,
            readTimeout: 180000,
            password: '',
            url: '',
            username: '',
            securityMode: 'None',
            securityPolicy: 'None',
            certFile: '',
            keyFile: '',
            scanGroups: [],
          }
        }

        dataSource.OPCUA_HA.scanGroups = dataSource.OPCUA_HA.scanGroups.map((scanGroup) => ({
          aggregate: scanGroup.Aggregate,
          resampling: scanGroup.resampling,
          scanMode: scanGroup.scanMode,
        }))

        dataSource.OPCUA_HA.securityMode = 'None'
        dataSource.OPCUA_HA.securityPolicy = 'None'
        dataSource.OPCUA_HA.keepSessionAlive = false
        dataSource.OPCUA_HA.certFile = ''
        dataSource.OPCUA_HA.keyFile = ''

        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCUA_HA, 'username')) {
          logger.info(`Add empty username for ${dataSource.name}`)
          dataSource.OPCUA_HA.username = ''
        }

        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCUA_HA, 'password')) {
          logger.info(`Add empty password for ${dataSource.name}`)
          dataSource.OPCUA_HA.password = ''
        }

        logger.info(`Add pointId fields in the points for ${dataSource.name}`)
        dataSource.points?.forEach((point) => {
          if (Object.prototype.hasOwnProperty.call(point, 'nodeId') && !Object.prototype.hasOwnProperty.call(point, 'pointId')) {
            point.pointId = point.nodeId
          }
        })
      }
      if (dataSource.protocol === 'OPCUA_DA') {
        logger.info(`Add OPCUA_DA security fields for data source ${dataSource.dataSourceId}`)

        // Case where a connector has been created but never set
        if (!dataSource.OPCUA_DA) {
          dataSource.OPCUA_DA = {}
        }
        dataSource.OPCUA_DA.securityMode = 'None'
        dataSource.OPCUA_DA.securityPolicy = 'None'
        dataSource.OPCUA_DA.keepSessionAlive = false
        dataSource.OPCUA_DA.certFile = ''
        dataSource.OPCUA_DA.keyFile = ''

        logger.info(`Add pointId fields in the points for ${dataSource.name}`)
        dataSource.points?.forEach((point) => {
          if (Object.prototype.hasOwnProperty.call(point, 'nodeId') && !Object.prototype.hasOwnProperty.call(point, 'pointId')) {
            point.pointId = point.nodeId
          }
        })
      }

      if (dataSource.protocol === 'OPCHDA') {
        logger.info(`Fixing OPCHDA settings for data source ${dataSource.dataSourceId}`)

        // Case where a connector has been created but never set
        if (!dataSource.OPCHDA) {
          dataSource.OPCHDA = {
            tcpPort: '2224',
            retryInterval: 10000,
            maxReturnValues: 0,
            maxReadInterval: 3600,
            readIntervalDelay: 200,
            agentFilename: '\\HdaAgent\\HdaAgent.exe',
            logLevel: 'debug',
            host: 'localhost',
            serverName: '',
            scanGroups: [],
          }
        }

        dataSource.OPCUA_HA.scanGroups = dataSource.OPCUA_HA.scanGroups.map((scanGroup) => ({
          aggregate: scanGroup.Aggregate,
          resampling: scanGroup.resampling,
          scanMode: scanGroup.scanMode,
        }))

        if (dataSource.agentFilename) {
          if (!dataSource.OPCHDA.agentFilename) {
            dataSource.OPCHDA.agentFilename = dataSource.agentFilename
          }
          delete dataSource.agentFilename
        }
        if (dataSource.tcpPort) {
          if (!dataSource.OPCHDA.tcpPort) {
            dataSource.OPCHDA.tcpPort = dataSource.tcpPort
          }
          delete dataSource.tcpPort
        }
        if (dataSource.logLevel) {
          if (!dataSource.OPCHDA.logLevel) {
            dataSource.OPCHDA.logLevel = dataSource.logLevel
          }
          delete dataSource.logLevel
        }
        if (dataSource.host) {
          if (!dataSource.OPCHDA.host) {
            dataSource.OPCHDA.host = dataSource.host
          }
          delete dataSource.host
        }
        if (dataSource.serverName) {
          if (!dataSource.OPCHDA.serverName) {
            dataSource.OPCHDA.serverName = dataSource.serverName
          }
          delete dataSource.serverName
        }
        if (dataSource.scanGroups) {
          if (!dataSource.OPCHDA.scanGroups) {
            dataSource.OPCHDA.scanGroups = dataSource.scanGroups
          }
          delete dataSource.scanGroups
        }
        if (!dataSource.OPCHDA.retryInterval) {
          dataSource.OPCHDA.retryInterval = 10000
        }

        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCHDA, 'readIntervalDelay')) {
          logger.info('Add readIntervalDelay')
          dataSource.OPCHDA.readIntervalDelay = 200
        }

        logger.info(`Add pointId fields in the points for ${dataSource.name}`)
        dataSource.points?.forEach((point) => {
          if (Object.prototype.hasOwnProperty.call(point, 'pointId') && !Object.prototype.hasOwnProperty.call(point, 'nodeId')) {
            point.nodeId = point.pointId
          }
        })
      }

      if (dataSource.protocol === 'ADS') {
        // Case where a connector has been created but never set
        if (!dataSource.ADS) {
          dataSource.ADS = {}
        }
      }

      if (dataSource.protocol === 'Modbus') {
        // Case where a connector has been created but never set
        if (!dataSource.Modbus) {
          dataSource.Modbus = {}
        }

        if (Object.prototype.hasOwnProperty.call(dataSource.Modbus, 'swapBytesinWords')) {
          logger.info('Change swapBytesinWords field to swapBytesInWords')
          dataSource.Modbus.swapBytesInWords = dataSource.Modbus.swapBytesinWords
          delete dataSource.Modbus.swapBytesinWords
        }
      }
    }
    for (const application of config.north.applications) {
      logger.info(`Fixing log parameters for application ${application.applicationId}`)
      if (!application.logParameters) {
        application.logParameters = {
          consoleLevel: 'engine',
          fileLevel: 'engine',
          sqliteLevel: 'engine',
          lokiLevel: 'engine',
        }
      } else if (!application.logParameters.lokiLevel) {
        application.logParameters.lokiLevel = 'engine'
      }
      if (application.logParameters.consoleLevel === 'silly') {
        application.logParameters.consoleLevel = 'trace'
      }
      if (application.logParameters.fileLevel === 'silly') {
        application.logParameters.fileLevel = 'trace'
      }
      if (application.logParameters.sqliteLevel === 'silly') {
        application.logParameters.sqliteLevel = 'trace'
      }

      if (!application.subscribedTo) {
        application.subscribedTo = []
      }

      if (Object.prototype.hasOwnProperty.call(application, 'enable')) {
        if (!Object.prototype.hasOwnProperty.call(application, 'enabled')) {
          application.enabled = application.enable
        }
        delete application.enable
      }

      if (application.api === 'AmazonS3') {
        logger.info(`Fixing Amazon S3 parameters for application ${application.applicationId}`)
        // Case where a connector has been created but never set
        if (!application.AmazonS3) {
          application.AmazonS3 = {}
        }

        if (Object.prototype.hasOwnProperty.call(application.AmazonS3.authentication, 'accessKey')) {
          application.AmazonS3.authentication.key = application.AmazonS3.authentication.accessKey
          delete application.AmazonS3.authentication.accessKey
        }

        if (!application.AmazonS3.proxy) {
          application.AmazonS3.proxy = ''
        }

        application.AmazonS3.region = ''
      }

      if (application.api === 'Console') {
        logger.info(`Fixing Console parameters for application ${application.applicationId}`)

        // Case where a connector has been created but never set
        if (!application.Console) {
          application.Console = {}
        }

        if (application.Console.verbose === undefined) {
          application.Console.verbose = false
        }
      }

      if (application.api === 'OIAnalytics') {
        logger.info(`Fixing OIAnalytics parameters for application ${application.applicationId}`)

        // Case where a connector has been created but never set
        if (!application.OIAnalytics) {
          application.OIAnalytics = {}
        }
        if (!application.OIAnalytics.proxy) {
          application.OIAnalytics.proxy = ''
        }

        // The groupCount and maxSendCount were omitted when OIAnalyticsFiles data source became OIAnalytics
        // that supports both files and values
        if (!application.caching.groupCount) {
          application.caching.groupCount = 1000
        }
        if (!application.caching.maxSendCount) {
          application.caching.maxSendCount = 10000
        }
      }

      if (application.api === 'OIConnect') {
        logger.info(`Fixing OIConnect parameters for application ${application.applicationId}`)

        // Case where a connector has been created but never set
        if (!application.OIConnect) {
          application.OIConnect = {}
        }

        if (!application.OIConnect.proxy) {
          application.OIConnect.proxy = ''
        }
      }

      if (application.api === 'MQTTNorth') {
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'certificate')) {
          logger.info(`Add certificate field to MQTTNorth parameters for application ${application.applicationId}`)
          application.MQTTNorth.certFile = ''
          application.MQTTNorth.keyFile = ''
          application.MQTTNorth.caFile = ''
          application.MQTTNorth.rejectUnauthorized = false
        }

        delete application.MQTTNorth.clientId // replaced by engineName

        // adding the default value for the new parameters for MQTTNorth connector (useDataKeyValue and keyParentValue)
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'useDataKeyValue')) {
          logger.info(`Add useDataKeyValue field to ${application.name}`)
          application.MQTTNorth.useDataKeyValue = false
        }
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'keyParentValue')) {
          logger.info(`Add keyParentValue field to ${application.name}`)
          application.MQTTNorth.keyParentValue = ''
        }
        if (!Object.prototype.hasOwnProperty.call(application.MQTTNorth, 'timestampPathInDataValue')) {
          logger.info(`Add timestampPathInDataValue field to ${application.name}`)
          application.MQTTNorth.timestampPathInDataValue = ''
        }
        application.api = 'MQTT'
        application.MQTT = application.MQTTNorth
        delete application.MQTTNorth
      }

      if (application.api === 'InfluxDB') {
        // adding the default value for the new parameters for InfluxDB connector (useDataKeyValue and keyParentValue)
        if (!Object.prototype.hasOwnProperty.call(application.InfluxDB, 'useDataKeyValue')) {
          logger.info(`Add useDataKeyValue field to ${application.name}`)
          application.InfluxDB.useDataKeyValue = false
        }
        if (!Object.prototype.hasOwnProperty.call(application.InfluxDB, 'keyParentValue')) {
          logger.info(`Add keyParentValue field to ${application.name}`)
          application.InfluxDB.keyParentValue = ''
        }
        if (!Object.prototype.hasOwnProperty.call(application.InfluxDB, 'timestampPathInDataValue')) {
          logger.info(`Add timestampPathInDataValue field to ${application.name}`)
          application.InfluxDB.timestampPathInDataValue = ''
        }
      }

      if (application.api === 'MongoDB') {
        // adding the default value for the new parameters for MongoDB connector (useDataKeyValue and keyParentValue)
        if (!Object.prototype.hasOwnProperty.call(application.MongoDB, 'useDataKeyValue')) {
          logger.info(`Add useDataKeyValue field to ${application.name}`)
          application[application.api].useDataKeyValue = false
        }
        if (!Object.prototype.hasOwnProperty.call(application.MongoDB, 'keyParentValue')) {
          logger.info(`Add keyParentValue field to ${application.name}`)
          application[application.api].keyParentValue = ''
        }
        if (Object.prototype.hasOwnProperty.call(application.MongoDB, 'timeStampKey')) {
          logger.info(`Change key timeStampKey to timestampKey for ${application.name}`)
          application.MongoDB.timestampKey = application.MongoDB.timeStampKey
          delete application.MongoDB.timeStampKey
        }

        if (Object.prototype.hasOwnProperty.call(application.MongoDB, 'createCollectionIndex')) {
          delete application.MongoDB.createCollectionIndex
        }

        if (Object.prototype.hasOwnProperty.call(application.MongoDB, 'addTimestampToIndex')) {
          delete application.MongoDB.addTimestampToIndex
        }
        if (!Object.prototype.hasOwnProperty.call(application.MongoDB, 'timestampPathInDataValue')) {
          logger.info(`Add timestampPathInDataValue field to ${application.name}`)
          application.MongoDB.timestampPathInDataValue = ''
        }
      }

      if (application.api === 'TimescaleDB') {
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'regExp')) {
          logger.info(`Add regExp field to ${application.name}`)
          application.TimescaleDB.regExp = '(.*)/'
        }
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'table')) {
          logger.info(`Add table field to ${application.name}`)
          application.TimescaleDB.table = '%1$s'
        }
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'optFields')) {
          logger.info(`Add optFields field to ${application.name}`)
          application.TimescaleDB.optFields = ''
        }
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'useDataKeyValue')) {
          logger.info(`Add useDataKeyValue field to ${application.name}`)
          application.TimescaleDB.useDataKeyValue = false
        }
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'keyParentValue')) {
          logger.info(`Add keyParentValue field to ${application.name}`)
          application.TimescaleDB.keyParentValue = ''
        }
        if (!Object.prototype.hasOwnProperty.call(application.TimescaleDB, 'timestampPathInDataValue')) {
          logger.info(`Add timestampPathInDataValue field to ${application.name}`)
          application.TimescaleDB.timestampPathInDataValue = ''
        }
      }
    }

    const cachePath = config.engine.caching.cacheFolder
    logger.info('Migrating dataSources name/id and cache/temp folders')
    for (const dataSource of config.south.dataSources) {
      // Generate new id for each connector
      dataSource.id = nanoid()
      // The old dataSourceId will be the new name
      dataSource.name = dataSource.dataSourceId

      // Rename the old temp folder if it exists
      const oldTmpFolder = path.resolve(cachePath, dataSource.name)
      let oldTmpFolderExists = false
      try {
        await fs.access(oldTmpFolder)
        oldTmpFolderExists = true
      } catch {
        logger.info(`No temp folder to migrate for dataSource ${dataSource.name}`)
      }
      if (oldTmpFolderExists) {
        logger.info(`Renaming old temp folder for datasource ${dataSource.name}`)
        const newTmpFolder = path.resolve(cachePath, dataSource.id)
        try {
          await fs.rename(oldTmpFolder, newTmpFolder)
        } catch (error) {
          logger.error(`Could not rename temp folder for dataSource: ${dataSource.name}`)
          throw error
        }
      }

      // Rename the already existing cache db files with the id
      const oldDataSourcePath = `${cachePath}/${dataSource.name}.db`
      let oldDataSourceDbExists = false
      try {
        await fs.access(oldDataSourcePath)
        oldDataSourceDbExists = true
      } catch {
        logger.info(`No db file to migrate for dataSource ${dataSource.name}`)
      }
      if (oldDataSourceDbExists) {
        const newDataSourcePath = path.resolve(cachePath, `${dataSource.id}.db`)
        logger.info(`Renaming old cache file ${oldDataSourcePath} to ${newDataSourcePath} for datasource ${dataSource.name}`)
        try {
          await fs.rename(oldDataSourcePath, newDataSourcePath)

          if (dataSource.protocol === 'SQL') {
            logger.info(`Update lastCompletedAt key for ${dataSource.name}`)
            const databasePath = `${config.engine.caching.cacheFolder}/${dataSource.id}.db`
            const database = databaseService.createConfigDatabase(databasePath)
            const lastCompletedAt = databaseService.getConfig(database, 'lastCompletedAt')
            databaseService.upsertConfig(database, `lastCompletedAt-${dataSource.scanMode}`, lastCompletedAt)
          }

          if (['OPCUA_HA', 'OPCHDA'].includes(dataSource.protocol)) {
            const databasePath = `${config.engine.caching.cacheFolder}/${dataSource.id}.db`
            const database = databaseService.createConfigDatabase(databasePath)
            if (!dataSource[dataSource.protocol].scanGroups) {
              dataSource[dataSource.protocol].scanGroups = []
            }
            const scanModes = dataSource[dataSource.protocol].scanGroups.map((scanGroup) => scanGroup.scanMode)
            // eslint-disable-next-line no-restricted-syntax
            for (const scanMode of scanModes) {
              logger.info(`Update lastCompletedAt-${scanMode} value for ${dataSource.name}`)
              const lastCompletedAtString = databaseService.getConfig(database, `lastCompletedAt-${scanMode}`)
              if (lastCompletedAtString) {
                const lastCompletedAt = new Date(parseInt(lastCompletedAtString, 10))
                databaseService.upsertConfig(database, `lastCompletedAt-${scanMode}`, lastCompletedAt.toISOString())
              }
            }
          }
        } catch (error) {
          logger.error(`Could not rename file ${oldDataSourcePath} to ${newDataSourcePath} for dataSource ${dataSource.name}`)
        }
      }

      // This field can now be deleted
      delete dataSource.dataSourceId
    }

    const valueCacheErrorDbPath = `${cachePath}/valueCache-error.db`
    let valueCacheErrorDbExists = false
    try {
      await fs.access(valueCacheErrorDbPath)
      valueCacheErrorDbExists = true
    } catch {
      logger.info(`No ${valueCacheErrorDbPath} file to migrate`)
    }
    if (valueCacheErrorDbExists) {
      // eslint-disable-next-line max-len
      logger.info(`Migration of value error database ${valueCacheErrorDbPath}: Renaming column name "application_id" into "application"`)
      try {
        await databaseMigrationService.changeColumnName(
          valueCacheErrorDbPath,
          'application_id',
          'application',
        )
      } catch (error) {
        logger.error(`Error during column name migration of value error database ${valueCacheErrorDbPath}: ${error}`)
      }
    }

    logger.info('Migrating applications name/id and cache/temp folders')
    const fileCacheDbPath = `${cachePath}/fileCache.db`
    let fileCacheDbExists = false
    try {
      await fs.access(fileCacheDbPath)
      fileCacheDbExists = true
    } catch {
      logger.info(`No ${fileCacheDbPath} file to migrate`)
    }

    const fileCacheErrorDbPath = `${cachePath}/fileCache.db`
    let fileCacheErrorDbExists = false
    try {
      await fs.access(fileCacheErrorDbPath)
      fileCacheErrorDbExists = true
    } catch {
      logger.info(`No ${fileCacheErrorDbPath} file to migrate`)
    }
    for (const application of config.north.applications) {
      application.id = nanoid()
      application.name = application.applicationId
      const oldApplicationPath = `${cachePath}/${application.name}.db`
      let oldApplicationDbExists = false
      try {
        await fs.access(oldApplicationPath)
        oldApplicationDbExists = true
      } catch {
        logger.info(`No ${oldApplicationPath} file to migrate for application ${application.name}`)
      }
      if (oldApplicationDbExists) {
        const newApplicationPath = path.resolve(cachePath, `${application.id}.db`)
        logger.info(`Renaming old cache file ${oldApplicationPath} to ${newApplicationPath} for application ${application.name}`)
        try {
          await fs.rename(oldApplicationPath, newApplicationPath)
        } catch (error) {
          logger.error(`Could not rename file ${oldApplicationPath} to ${newApplicationPath} for application ${application.name}`)
          throw error
        }

        // eslint-disable-next-line max-len
        logger.info(`Migration of values database ${cachePath}/${application.id}.db: Renaming column name "data_source_id" into "data_source" for application ${application.name}`)
        try {
          databaseMigrationService.changeColumnName(
            newApplicationPath,
            'data_source_id',
            'data_source',
          )
        } catch (error) {
          logger.error(`Error during column name migration of ${newApplicationPath}: ${error}`)
        }

        if (fileCacheDbExists) {
          // eslint-disable-next-line max-len
          logger.info(`Migration of file database ${fileCacheDbPath}: Changing application value from ${application.name} to ${application.id}`)
          try {
            databaseMigrationService.changeColumnValue(
              fileCacheDbPath,
              'application',
              application.name,
              application.id,
            )
          } catch (error) {
            logger.error(`Error during column value migration of ${fileCacheDbPath}: ${error}`)
          }
        }

        if (fileCacheErrorDbExists) {
          // eslint-disable-next-line max-len
          logger.info(`Migration of file error database ${fileCacheErrorDbPath}: Changing application value from ${application.name} to ${application.id}`)
          try {
            databaseMigrationService.changeColumnValue(
              fileCacheErrorDbPath,
              'application',
              application.name,
              application.id,
            )
          } catch (error) {
            logger.error(`Error during column value migration of ${fileCacheErrorDbPath}: ${error}`)
          }
        }

        if (valueCacheErrorDbExists) {
          // eslint-disable-next-line max-len
          logger.info(`Migration of value error database ${valueCacheErrorDbPath}: Changing application value from ${application.name} to ${application.id}`)
          try {
            databaseMigrationService.changeColumnValue(
              valueCacheErrorDbPath,
              'application',
              application.name,
              application.id,
            )
          } catch (error) {
            logger.error(`Error during column value migration of ${valueCacheErrorDbPath}: ${error}`)
          }
        }
      }
      delete application.applicationId

      if (application.subscribedTo?.length > 0) {
        // eslint-disable-next-line max-len
        logger.info(`Changing 'subscribedTo' field from dataSourceName to dataSource.id for application ${application.name}. Obsolete subscription will be removed`)
        // Change the names of subscribed data sources to its ids in the 'subscribedTo' list
        application.subscribedTo = application.subscribedTo
          // eslint-disable-next-line max-len
          .filter((dataSourceName) => config.south.dataSources.find((dataSource) => dataSource.name === dataSourceName) || config.engine.externalSources.find((externalDataSourceName) => externalDataSourceName === dataSourceName))
          .map((dataSourceName) => {
            const subscribedDataSource = config.south.dataSources.find((dataSource) => dataSource.name === dataSourceName)
            if (subscribedDataSource) {
              return subscribedDataSource.id
            }
            return dataSourceName
          })
      }
    }
  },
  25: (config, logger) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'OPCHDA') {
        if (!Object.prototype.hasOwnProperty.call(dataSource.OPCHDA, 'readTimeout')) {
          logger.info('Add readTimeout field to OPCHDA')
          dataSource.OPCHDA.readTimeout = 180
        }
      }
    })
  },
  26: async (config, logger) => {
    logger.info('Removing cache folder from engine settings.')
    delete config.engine.caching.cacheFolder

    logger.info('Removing history query from engine settings.')
    delete config.engine.historyQuery

    const archiveSettings = config.engine.caching.archive
    delete config.engine.caching.archive
    delete archiveSettings.archiveFolder

    await createFolder((path.resolve('./cache/data-stream')))
    await createFolder(path.resolve('./cache/history-query'))

    // Move keys and certs outside cache folder
    try {
      await fs.rename(path.resolve('./cache', 'certs'), path.resolve('./certs'))
      await fs.rename(path.resolve('./cache', 'keys'), path.resolve('./keys'))
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }

    for (const north of config.north.applications) {
      logger.info(`Add archive settings to North connector ${north.id}`)
      north.caching.archive = archiveSettings
      logger.info(`Add retry count to North connector ${north.id}`)
      north.caching.retryCount = config.engine.httpRequest.retryCount

      logger.info(`Moving cache for North connector ${north.id}.`)
      const northCache = path.resolve('./cache/data-stream', `north-${north.id}`)
      const northCacheFilesFolder = path.resolve(northCache, 'files')
      await createFolder(northCache)
      await createFolder(path.resolve(northCache, 'archive'))
      await createFolder(northCacheFilesFolder)
      await createFolder(path.resolve(northCache, 'errors'))
      try {
        await fs.rename(path.resolve('./cache', `${north.id}.db`), path.resolve(northCache, 'values.db'))
        databaseMigrationService.changeColumnName(
          path.resolve(northCache, 'values.db'),
          'data_source',
          'south',
        )
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }
      try {
        await fs.rm(path.resolve('./cache', `${north.id}.db-journal`), { force: true })
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }
      try {
        await fs.copyFile(path.resolve('./cache', 'fileCache.db'), path.resolve(northCache, 'files.db'))
        const database = db(path.resolve(northCache, 'files.db'))
        const query = 'SELECT path, timestamp '
            + 'FROM cache '
            + 'WHERE application = ? '
            + 'ORDER BY timestamp'
        const results = database.prepare(query).all(north.id)
        databaseMigrationService.removeColumn(path.resolve(northCache, 'files.db'), 'cache', 'application')
        // Empty the database to rewrite the new file path
        database.prepare('DELETE FROM cache;').run()
        for (const result of results) {
          try {
            const newFilePath = path.resolve(northCacheFilesFolder, path.basename(result.path))
            await fs.copyFile(path.resolve(result.path), newFilePath)

            // Create new entry for this file
            const newFileQuery = 'INSERT INTO cache (timestamp, path) VALUES (?, ?)'
            database.prepare(newFileQuery).run(result.timestamp, newFilePath)
          } catch (copyError) {
            if (copyError.code !== 'ENOENT') {
              logger.error(copyError)
            } else {
              logger.error(`File ${result.path} not found.`)
            }
          }
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }
    }
    try {
      const database = db(path.resolve('./cache', 'fileCache.db'))
      const query = 'SELECT DISTINCT path '
          + 'FROM cache '
          + 'ORDER BY timestamp'
      const results = database.prepare(query).all()
      logger.info(`Removing ${results.length} files from cache.`)

      for (const result of results) {
        try {
          await fs.rm(path.resolve(result.path), { force: true })
        } catch (removeError) {
          if (removeError.code !== 'ENOENT') {
            logger.error(removeError)
          }
        }
      }
    } catch (err) {
      logger.error(err)
    }

    try {
      await fs.rm(path.resolve('./cache', 'fileCache.db'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'fileCache.db-journal'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'fileCache-error.db'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'fileCache-error.db-journal'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'valueCache.db'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'valueCache-error.db'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'valueCache.db-journal'), { force: true })
    } catch (err) {
      logger.warn(err)
    }
    try {
      await fs.rm(path.resolve('./cache', 'valueCache-error.db-journal'), { force: true })
    } catch (err) {
      logger.warn(err)
    }

    logger.info('Removing retry count from http request config.')
    delete config.engine.httpRequest.retryCount

    for (const south of config.south.dataSources) {
      logger.info(`Moving cache for South connector ${south.id}.`)
      const southCache = path.resolve('./cache/data-stream', `south-${south.id}`)
      await createFolder(southCache)

      try { // move cache and remove associated db-journal if it exists
        await fs.stat(path.resolve('./cache', `${south.id}.db`))
        await fs.rename(path.resolve('./cache', `${south.id}.db`), path.resolve(southCache, 'cache.db'))
        await fs.rm(path.resolve('./cache', `${south.id}.db-journal`), { force: true })
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }
      try { // Remove tmp folder if it exists
        await fs.stat(path.resolve('./cache', south.id))
        await fs.rmdir(path.resolve('./cache', south.id), { recursive: true })
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }

      if (south.protocol === 'Modbus') {
        if (Object.prototype.hasOwnProperty.call(south, 'points')) {
          logger.info('Update Modbus point data types')
          south.points = south.points.map((point) => {
            if (point.type === 'Uint16') {
              point.type = 'UInt16'
            } else if (point.type === 'UInt64') {
              point.type = 'BigUInt64'
            } else if (point.type === 'Int64') {
              point.type = 'BigInt64'
            }
            return point
          })
        }
      }
    }

    logger.info('Removing historyQuery.db and historyQuery folder')
    try {
      await fs.rm(path.resolve('./historyQuery.db'), { force: true })
      await fs.rmdir(path.resolve('./historyQuery'), { recursive: true })
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }

    logger.info('Removing applications / dataSources from north / south settings.')
    config.north = config.north.applications
    config.south = config.south.dataSources

    await createFolder('./logs')
    logger.info('Removing file logs file name from config. Default will be "logs/journal.log".')
    const oldLogFileName = path.basename(config.engine.logParameters.fileLog.fileName)
    const newFileLogFilePath = path.resolve('./logs', 'journal.log')
    try {
      await fs.rename(oldLogFileName, newFileLogFilePath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }
    delete config.engine.logParameters.fileLog.fileName

    const oldLogSqlFileName = path.basename(config.engine.logParameters.sqliteLog.fileName)
    const newFileLogSqlPath = path.resolve('./logs', 'journal.db')
    try {
      await fs.rename(oldLogSqlFileName, newFileLogSqlPath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }
    delete config.engine.logParameters.sqliteLog.fileName

    try {
      await fs.rm(path.resolve('./migration-journal.log'), { force: true })
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }
    try {
      await fs.rm(path.resolve('./OIBus-main-journal.log'), { force: true })
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error(err)
      }
    }
  },
  27: async (config, logger) => {
    for (const north of config.north) {
      logger.info(`Change api field to type for North "${north.id}".`)
      north.type = north.api
      delete north.api
    }

    for (const south of config.south) {
      logger.info(`Change protocol field to type for South "${south.id}".`)
      south.type = south.protocol
      delete south.protocol
    }
  },
  28: async (config, logger) => {
    for (const north of config.north) {
      logger.info(`Delete file cache DBs for North "${north.id}".`)
      try {
        await fs.rm(path.resolve(`./cache/data-stream/north-${north.id}/files.db`), { force: true })
        await fs.rm(path.resolve(`./cache/data-stream/north-${north.id}/files-error.db`), { force: true })
        await fs.rm(path.resolve(`./cache/history-query/north-${north.id}/files.db`), { force: true })
        await fs.rm(path.resolve(`./cache/history-query/north-${north.id}/files-error.db`), { force: true })
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(err)
        }
      }
    }
  },
}
