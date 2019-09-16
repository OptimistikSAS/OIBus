const fs = require('fs')

const ConfigService = require('../services/config.service.class')
const migrationRules = require('./migrationRules')

const DEFAULT_VERSION = '0.3.10'

class Migration {
  constructor(version) {
    this.oibusVersion = version
    this.configFile = ConfigService.getConfigFile()
  }

  /**
   * Migration implementation.
   * Sort version and migrate until we reach actual OIBus version.
   * @returns {void}
   */
  migrateImpl() {
    Object.keys(migrationRules)
      .sort()
      .forEach((version) => {
        if ((version > this.fromVersion) && (version <= this.oibusVersion)) {
          if (migrationRules[version] instanceof Function) {
            migrationRules[version](this.config, this.fromVersion)
          }
          this.fromVersion = version
        }
      })
  }

  /**
   * Migrate if needed.
   * @returns {void}
   */
  migrate() {
    if (fs.existsSync(this.configFile)) {
      this.config = ConfigService.tryReadFile(this.configFile)
      this.fromVersion = this.config.version || DEFAULT_VERSION
      if (this.fromVersion < this.oibusVersion) {
        this.migrateImpl()
      } else {
        console.info('Config file is up-to-date, no migrating needed.')
      }
    } else {
      console.info(`${this.configFile} doesn't exists. No migration needed.`)
    }
  }
}

module.exports = Migration
