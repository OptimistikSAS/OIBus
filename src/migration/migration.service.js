const fs = require('fs/promises')

const path = require('path')
const ConfigService = require('../services/config.service.class')
const migrationRules = require('./migrationRules')
const Logger = require('../engine/logger/Logger.class')

const REQUIRED_SCHEMA_VERSION = 24
const DEFAULT_VERSION = 1

/**
 * Default parameters for migration service logger
 * Dedicated migrations settings to avoid migration errors when migrating logger
 */
const engineConfigLogParameters = {
  engineName: 'OIBus-migration',
  logParameters: {
    consoleLog: { level: 'debug' },
    fileLog: {
      level: 'debug',
      fileName: './migration-journal.log',
      maxSize: 1000000,
      numberOfFiles: 5,
      tailable: true,
    },
    sqliteLog: { level: 'none' },
    lokiLog: { level: 'none' },
  },
}

/**
 * Migration implementation.
 * Iterate through versions and migrate until we reach actual OIBus version.
 * @param {number} configVersion - The config file version
 * @param {object} config - The configuration
 * @param {string} configFile - The config file
 * @param {object} logger - The logger
 * @returns {void}
 */
const migrateImpl = async (configVersion, config, configFile, logger) => {
  let iterateVersion = configVersion
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const version of Object.keys(migrationRules)) {
      const intVersion = parseInt(version, 10)
      if ((intVersion > iterateVersion) && (intVersion <= REQUIRED_SCHEMA_VERSION)) {
        if (migrationRules[version] instanceof Function) {
          logger.info(`Migrating from version ${iterateVersion} to version ${intVersion}`)
          config.schemaVersion = intVersion
          // eslint-disable-next-line no-await-in-loop
          await migrationRules[version](config, logger)
        } else {
          logger.info(`Invalid rules definition to migrate to version ${version}`)
        }
        iterateVersion = intVersion
      }
    }
  } catch (error) {
    logger.error(error)
    throw new Error(`Migration error exception: ${error}`)
  }

  if (iterateVersion !== REQUIRED_SCHEMA_VERSION) {
    logger.info(`Unable to reach version ${REQUIRED_SCHEMA_VERSION} during migration`)
  }

  ConfigService.backupConfigFile(configFile)
  ConfigService.saveConfig(configFile, config)
}

/**
 * Migrate if needed.
 * @param {string} configFile - The config file
 * @returns {Promise<void>} - Promise resolve if migration succeeds
 */
const migrate = async (configFile) => {
  const logger = new Logger('Migration')
  engineConfigLogParameters.logParameters.fileLog.fileName = `${path.dirname(configFile)}/logs/migration.log`
  engineConfigLogParameters.logParameters.sqliteLog.fileName = `${path.dirname(configFile)}/logs/migration.db`
  try {
    await logger.changeParameters(engineConfigLogParameters)

    let fileStat
    try {
      fileStat = await fs.stat(configFile)
    } catch (fileNotFound) {
      logger.warn('No settings file found. No need to update')
    }
    if (fileStat) {
      const config = ConfigService.tryReadFile(configFile)
      const configVersion = config.schemaVersion || DEFAULT_VERSION
      if (configVersion < REQUIRED_SCHEMA_VERSION) {
        logger.info(`Config file is not up-to-date. Starting migration from version ${configVersion} to ${REQUIRED_SCHEMA_VERSION}`)
        await migrateImpl(configVersion, config, configFile, logger)
      }
    }
  } catch (migrationError) {
    logger.error(migrationError)
  }
}

module.exports = { migrate }
