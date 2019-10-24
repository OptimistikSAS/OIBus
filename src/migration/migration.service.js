const fs = require('fs')

const ConfigService = require('../services/config.service.class')
const migrationRules = require('./migrationRules')

const REQUIRED_SCHEMA_VERSION = 3
const DEFAULT_VERSION = 1
const LOG_SOURCE = 'migration'

/**
 * Migration implementation.
 * Iterate through versions and migrate until we reach actual OIBus version.
 * @param {string} configVersion - The config file version
 * @param {object} config - The configuration
 * @param {string} configFile - The config file
 * @returns {void}
 */
const migrateImpl = (configVersion, config, configFile) => {
  let iterateVersion = configVersion
  Object.keys(migrationRules)
    .forEach((version) => {
      const intVersion = parseInt(version, 10)
      if ((intVersion > iterateVersion) && (intVersion <= REQUIRED_SCHEMA_VERSION)) {
        if (migrationRules[version] instanceof Function) {
          logger.info(`Migrating from version ${iterateVersion} to version ${intVersion}`, LOG_SOURCE)
          config.schemaVersion = intVersion
          migrationRules[version](config)
        } else {
          logger.info(`Invalid rules definition to migrate to version ${version}`, LOG_SOURCE)
        }
        iterateVersion = intVersion
      }
    })

  if (iterateVersion !== REQUIRED_SCHEMA_VERSION) {
    logger.info(`Unable to reach version ${REQUIRED_SCHEMA_VERSION} during migration`, LOG_SOURCE)
  }

  ConfigService.backupConfigFile(configFile)
  ConfigService.saveConfig(configFile, config)
}

/**
 * Migrate if needed.
 * @param {string} configFile - The config file
 * @returns {void}
 */
const migrate = (configFile) => {
  if (fs.existsSync(configFile)) {
    const config = ConfigService.tryReadFile(configFile)
    const configVersion = config.schemaVersion || DEFAULT_VERSION
    if (configVersion < REQUIRED_SCHEMA_VERSION) {
      logger.info(`Config file is not up-to-date. Starting migration from version ${configVersion} to ${REQUIRED_SCHEMA_VERSION}`, LOG_SOURCE)
      migrateImpl(configVersion, config, configFile)
    } else {
      logger.info('Config file is up-to-date, no migrating needed.', LOG_SOURCE)
    }
  } else {
    logger.info(`${configFile} doesn't exists. No migration needed.`, LOG_SOURCE)
  }
}

module.exports = { migrate }
