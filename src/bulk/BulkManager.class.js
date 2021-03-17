const Logger = require('../engine/Logger.class')

class BulkManager {
  constructor(engine) {
    this.engine = engine
    this.logger = Logger.getDefaultLogger()

    const { engineConfig } = engine.configService.getConfig()
    const { bulk: { bulkFolder } } = engineConfig
    this.bulkFolder = bulkFolder

    this.bulks = []
  }
}

module.exports = BulkManager
