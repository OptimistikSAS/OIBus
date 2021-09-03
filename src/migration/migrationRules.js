/* eslint-disable no-restricted-syntax, no-await-in-loop */

const fs = require('fs')
const { nanoid } = require('nanoid')
const path = require('path')
const Logger = require('../engine/Logger.class')
const databaseMigrationService = require('./database.migration.service')

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
  24: async (config) => {
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
        maxSize: config.engine.logParameters.sqliteMaxFileSize,
      },
      lokiLog: {
        level: 'none',
        host: '',
        interval: 60,
      },
    }

    if (typeof config.engine.safeMode === 'undefined') {
      config.engine.safeMode = false
    }
    config.engine.healthSignal = {
      logging: {
        enabled: true,
        frequency: 3600,
        username: '',
        password: '',
      },
      http: {
        enabled: config.engine.aliveSignal.enabled,
        host: config.engine.aliveSignal.host,
        endpoint: config.engine.aliveSignal.endpoint,
        authentication: config.engine.aliveSignal.authentication,
        frequency: config.engine.aliveSignal.frequency,
        proxy: config.engine.aliveSignal.proxy,
      },
    }
    delete config.engine.aliveSignal
    for (const dataSource of config.south.dataSources) {
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
      if (dataSource.protocol === 'FolderScanner') {
        // a previous migration forgot to update the compression parameter (called "compress" before)
        if (typeof dataSource.FolderScanner.compression === 'undefined') {
          if (typeof dataSource.FolderScanner.compress !== 'undefined') {
            dataSource.FolderScanner.compression = dataSource.FolderScanner.compress
            delete dataSource.FolderScanner.compress
          } else {
            dataSource.FolderScanner.compression = false
          }
        }
        if (dataSource.FolderScanner.inputFolder) {
          // a previous commit add the endsWith('/') validation in the front, causing error when going back to the
          // application after an update if the inputFolder did not include the '/' previously
          if (!dataSource.FolderScanner.inputFolder.endsWith('/')) {
            dataSource.FolderScanner.inputFolder = `${dataSource.FolderScanner.inputFolder}/`
          }
        } else {
          dataSource.FolderScanner.inputFolder = './input/'
        }
      }
      if (dataSource.protocol === 'SQLDbToFile') {
        // when the driver sqlite was added to SQLDbToFile, the databasePath was forgotten in the migration, causing the
        // config to change (adding the databasePath default value) after an update when the user visit a SQLDbToFile
        // connector page
        if (typeof dataSource.SQLDbToFile.databasePath === 'undefined') {
          dataSource.SQLDbToFile.databasePath = './sqlite.db'
        }
      }
    }
    for (const application of config.north.applications) {
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
      if (application.api === 'AmazonS3') {
        application.AmazonS3.key = application.AmazonS3.accessKey
      }
      config.engine.caching.archive = {
        enabled: config.engine.caching.archiveMode === 'archive',
        archiveFolder: config.engine.caching.archiveFolder,
        retentionDuration: 0,
      }
      delete config.engine.caching.archiveMode
      delete config.engine.caching.archiveFolder
    }

    const cachePath = config.engine.caching.cacheFolder
    for (const dataSource of config.south.dataSources) {
      // Generate new id for each connector
      dataSource.id = nanoid()
      // The old dataSourceId will be the new name
      dataSource.name = dataSource.dataSourceId

      // Rename the old temp folder if it exists
      const oldTmpFolder = path.resolve(cachePath, dataSource.name)
      if (fs.existsSync(oldTmpFolder)) {
        logger.info(`Renaming old temp folder for datasource ${dataSource.name}`)
        const newTmpFolder = path.resolve(cachePath, dataSource.id)
        await fs.rename(oldTmpFolder, newTmpFolder, (error) => {
          if (error) {
            logger.error(`Could not rename temp folder for dataSource: ${dataSource.name}`)
          }
        })
      }

      // Rename the already existing cache db files with the id
      const oldDataSourcePath = `${cachePath}/${dataSource.name}.db`
      if (fs.existsSync(oldDataSourcePath)) {
        logger.info(`Renaming old cache file for datasource ${dataSource.name}`)
        await fs.rename(oldDataSourcePath,
          `${cachePath}/${dataSource.id}.db`, async (error) => {
            if (error) {
              logger.error(`Could not rename datasource: ${dataSource.name}`)
            }
          })
      }
      // This field should be deleted
      delete dataSource.dataSourceId
    }

    // eslint-disable-next-line max-len
    logger.info(`Migration of value error database ${cachePath}/valueCache-error.db: Renaming column name "application_id" into "application"`)
    await databaseMigrationService.changeColumnName(`${cachePath}/valueCache-error.db`,
      'application_id',
      'application')

    for (const application of config.north.applications) {
      application.id = nanoid()
      application.name = application.applicationId
      const oldApplicationPath = `${cachePath}/${application.name}.db`
      if (fs.existsSync(oldApplicationPath)) {
        logger.info(`Renaming old cache path for datasource ${application.name}`)
        await fs.rename(oldApplicationPath,
          `${cachePath}/${application.id}.db`, async (error) => {
            if (error) {
              logger.error(`Could not rename application: ${application.name}`)
            }
          })

        // eslint-disable-next-line max-len
        logger.info(`Migration of values database ${cachePath}/${application.id}.db: Renaming column name "data_source_id" into "data_source" for application ${application.name}`)
        await databaseMigrationService.changeColumnName(`${cachePath}/${application.id}.db`,
          'data_source_id',
          'data_source')
        // eslint-disable-next-line max-len
        logger.info(`Migration of file database ${cachePath}/fileCache.db:  Changing application value from ${application.name} to ${application.id}`)
        await databaseMigrationService.changeColumnValue(`${cachePath}/fileCache.db`,
          'application',
          application.name,
          application.id)

        // eslint-disable-next-line max-len
        logger.info(`Migration of file error database ${cachePath}/fileCache-error.db:  Changing application value from ${application.name} to ${application.id}`)
        await databaseMigrationService.changeColumnValue(`${cachePath}/fileCache-error.db`,
          'application',
          application.name,
          application.id)
        // eslint-disable-next-line max-len
        logger.info(`Migration of value error database ${cachePath}/valueCache-error.db:  Changing application value from ${application.name} to ${application.id}`)
        await databaseMigrationService.changeColumnValue(`${cachePath}/valueCache-error.db`,
          'application',
          application.name,
          application.id)
      }
      delete application.applicationId

      // Change the names of subscribed data sources to its ids in the 'subscribedTo' list
      application.subscribedTo = application.subscribedTo.map((dataSourceName) => {
        const subscribedDataSource = config.south.dataSources.find((dataSource) => dataSource.name === dataSourceName)
        return subscribedDataSource.id
      })
    }
  },
}
