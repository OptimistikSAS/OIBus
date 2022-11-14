const fs = require('node:fs/promises')
const path = require('node:path')

const migrationRules = require('./migration-rules')
const LoggerService = require('../service/logger/logger.service')

const REQUIRED_SCHEMA_VERSION = 29
const DEFAULT_VERSION = 1

/**
 * Migration implementation.
 * Iterate through versions and migrate until we reach actual OIBus version.
 * @param {number} configVersion - The config file version
 * @param {object} config - The configuration
 * @param {string} configFilePath - The config file
 * @param {object} logger - The logger
 * @returns {void}
 */
const migrateImpl = async (configVersion, config, configFilePath, logger) => {
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

  const timestamp = new Date().getTime()
  const backupFilename = `${path.parse(configFilePath).name}-${timestamp}${path.parse(configFilePath).ext}`
  const backupPath = path.resolve(path.parse(configFilePath).dir, backupFilename)
  await fs.copyFile(configFilePath, backupPath)
  await fs.writeFile(configFilePath, JSON.stringify(config, null, 4), 'utf8')
}

/**
 * Migrate if needed.
 * @param {String} configFilePath - The config file path
 * @param {String} oibusName - The name of this oibus
 * @param {Object} logParameters - The log parameters to use (given by index.js)
 * @returns {Promise<void>} - The result promise
 */
const migrate = async (configFilePath, oibusName, logParameters) => {
  const logger = new LoggerService('migration')
  try {
    await logger.changeParameters(oibusName, logParameters)

    let fileStat
    try {
      fileStat = await fs.stat(configFilePath)
    } catch (fileNotFound) {
      logger.warn('No settings file found. No need to update')
    }
    if (fileStat) {
      const config = JSON.parse(await fs.readFile(configFilePath, 'utf8'))
      const configVersion = config.schemaVersion || DEFAULT_VERSION
      if (configVersion < REQUIRED_SCHEMA_VERSION) {
        logger.info(`Config file is not up-to-date. Starting migration from version ${configVersion} to ${REQUIRED_SCHEMA_VERSION}`)
        await migrateImpl(configVersion, config, configFilePath, logger)
      }
    }
  } catch (migrationError) {
    logger.error(migrationError)
  }
}

module.exports = { migrate }
