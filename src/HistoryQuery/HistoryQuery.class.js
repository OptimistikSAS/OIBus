const ProtocolFactory = require('../south/ProtocolFactory.class')

class HistoryQuery {
  static STATUS_PENDING = 'pending';

  static STATUS_EXPORTING = 'exporting';

  static STATUS_IMPORTING = 'importing';

  static STATUS_FINISHED = 'finished';

  constructor(engine, logger, folder, startTimestamp, endTimestamp, filenamePattern, dataSource, status) {
    this.engine = engine
    this.logger = logger
    this.folder = folder
    this.dataSource = dataSource
    this.startTimestamp = startTimestamp
    this.endTimestamp = endTimestamp
    this.filenamePattern = filenamePattern
    this.status = status
  }

  start() {
    switch (this.status) {
      case HistoryQuery.STATUS_PENDING:
        this.startExport()
        break
      case HistoryQuery.STATUS_EXPORTING:
        break
      case HistoryQuery.STATUS_IMPORTING:
        break
      case HistoryQuery.STATUS_FINISHED:
        break
      default:
        this.logger.error(`Invalid historyQuery status: ${this.status}`)
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

      this.status = HistoryQuery.STATUS_EXPORTING
    }
  }

  initSouth() {
    const { protocol, enabled } = this.dataSource
    return enabled ? ProtocolFactory.create(protocol, this.dataSource, this.engine) : null
  }
}

module.exports = HistoryQuery
