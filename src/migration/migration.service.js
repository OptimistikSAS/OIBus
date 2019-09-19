const fs = require('fs')

const ConfigService = require('../services/config.service.class')
const migrationRules = require('./migrationRules')

const DEFAULT_VERSION = '0.3.10'

const configFile = ConfigService.getConfigFile()

/**
 * Migration implementation.
 * Iterate through versions and migrate until we reach actual OIBus version.
 * @param {string} configVersion - The config file version
 * @param {string} oibusVersion - The OIBus version
 * @param {object} config - The configuration
 * @returns {void}
 */
const migrateImpl = (configVersion, oibusVersion, config) => {
  let iterateVersion = configVersion
  Object.keys(migrationRules)
    .forEach((version) => {
      if ((version > iterateVersion) && (version <= oibusVersion)) {
        if (migrationRules[version] instanceof Function) {
          console.info(`Migrating from version ${iterateVersion} to version ${version}`)
          config.version = version
          migrationRules[version](config, iterateVersion)
        }
        iterateVersion = version
      }
    })

  ConfigService.backupConfigFile(configFile)
  ConfigService.saveConfig(configFile, config)
}

/**
 * Migrate if needed.
 * @param {string} oibusVersion - The actual OIBus version
 * @returns {void}
 */
const migrate = (oibusVersion) => {
  if (fs.existsSync(configFile)) {
    const config = ConfigService.tryReadFile(configFile)
    const configVersion = config.version || DEFAULT_VERSION
    if (configVersion < oibusVersion) {
      console.info(`Config file is not up-to-date. Starting migration from version ${configVersion} to ${oibusVersion}`)
      migrateImpl(configVersion, oibusVersion, config)
    } else {
      console.info('Config file is up-to-date, no migrating needed.')
    }
  } else {
    console.info(`${configFile} doesn't exists. No migration needed.`)
  }
}

module.exports = { migrate }
