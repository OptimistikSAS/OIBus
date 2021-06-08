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
    this.dataSource.readUntilAt = endTimestamp
    this.startTimestamp = startTimestamp
    this.endTimestamp = endTimestamp
    this.filenamePattern = filenamePattern
    this.status = status
  }

  start() {
    switch (this.status) {
      case HistoryQuery.STATUS_PENDING:
        this.exportFromSouth()
        break
      case HistoryQuery.STATUS_EXPORTING:
        this.exportFromSouth()
        break
      case HistoryQuery.STATUS_IMPORTING:
        this.importToNorth()
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

  async exportFromSouth() {
    this.south = this.initSouth()
    if (this.south) {
      await this.south.connect()

      this.status = HistoryQuery.STATUS_EXPORTING
    }
  }

  async importToNorth() {
    this.logger('ToDo')
  }

  initSouth() {
    const { protocol, enabled } = this.dataSource
    return enabled ? ProtocolFactory.create(protocol, this.dataSource, this.engine) : null
  }
}

module.exports = HistoryQuery
