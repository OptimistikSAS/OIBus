const ProtocolFactory = require('../south/ProtocolFactory.class')

class Bulk {
  static STATUS_PENDING = 'pending';

  static STATUS_EXPORTING = 'exporting';

  static STATUS_IMPORTING = 'importing';

  static STATUS_FINISHED = 'finished';

  constructor(engine, logger, bulkFolder, startTimestamp, endTimestamp, filenamePattern, dataSource, status) {
    this.engine = engine
    this.logger = logger
    this.bulkFolder = bulkFolder
    this.dataSource = dataSource
    this.startTimestamp = startTimestamp
    this.endTimestamp = endTimestamp
    this.filenamePattern = filenamePattern
    this.status = status
  }

  start() {
    switch (this.status) {
      case Bulk.STATUS_PENDING:
        this.startExport()
        break
      case Bulk.STATUS_EXPORTING:
        break
      case Bulk.STATUS_IMPORTING:
        break
      case Bulk.STATUS_FINISHED:
        break
      default:
        this.logger.error(`Invalid bulk status: ${this.status}`)
    }
  }

  async stop() {
    if (this.south) {
      await this.south.disconnect()
    }
  }

  async startExport() {
    this.south = this.initSouth()
    if (this.south) {
      await this.south.connect()

      this.status = Bulk.STATUS_EXPORTING
    }
  }

  initSouth() {
    const { protocol, enabled } = this.dataSource
    return enabled ? ProtocolFactory.create(protocol, this.dataSource, this.engine) : null
  }
}

module.exports = Bulk
