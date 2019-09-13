const fs = require('fs')

const ConfigService = require('../services/config.service.class')
const migrationRules = require('./migrationRules')

const DEFAULT_VERSION = '0.3.10'

class Migration {
  constructor(version) {
    this.version = version
    this.configFile = ConfigService.getConfigFile()
  }

  migrateImpl() {
    console.info(`Migrating to version ${this.version}`)
    console.info(migrationRules)
  }

  migrate() {
    if (fs.existsSync(this.configFile)) {
      this.config = ConfigService.tryReadFile(this.configFile)
      this.config.version = this.config.version || DEFAULT_VERSION
      if (this.config.version !== this.version) {
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
