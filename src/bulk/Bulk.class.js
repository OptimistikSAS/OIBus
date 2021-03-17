class Bulk {
  static STATUS_PENDING = 'pending';

  static STATUS_EXPORTING = 'exporting';

  static STATUS_IMPORTING = 'importing';

  constructor(logger, bulkFolder, south) {
    this.logger = logger
    this.bulkFolder = bulkFolder
    this.south = south
    this.status = Bulk.STATUS_PENDING
  }

  async start() {
    this.south.connect()
  }

  async stop() {
    this.south.disconnect()
  }
}

module.exports = Bulk
