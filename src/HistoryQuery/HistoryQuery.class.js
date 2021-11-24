class HistoryQuery {
  // Waiting to be starteds
  static STATUS_PENDING = 'pending'

  // Exporting data from south
  static STATUS_EXPORTING = 'exporting'

  // Importing data into North
  static STATUS_IMPORTING = 'importing'

  // History query finished
  static STATUS_FINISHED = 'finished'

  constructor(engine, logger, config, dataSource, application) {
    this.engine = engine
    this.logger = logger
    this.config = config
    this.id = config.id
    this.status = config.status
    this.dataSource = dataSource
    this.application = application
    this.startTime = new Date(config.startTime)
    this.endTime = new Date(config.endTime)
    this.filePattern = config.filePattern
  }

  /**
   * Start history query
   * @returns {void}
   */
  start() {
    switch (this.status) {
      case HistoryQuery.STATUS_PENDING:
      case HistoryQuery.STATUS_EXPORTING:
        this.startExport()
        break
      case HistoryQuery.STATUS_IMPORTING:
        this.startImport()
        break
      case HistoryQuery.STATUS_FINISHED:
        this.engine.runNextHistoryQuery()
        break
      default:
        this.logger.error(`Invalid historyQuery status: ${this.status}`)
        this.engine.runNextHistoryQuery()
    }
  }

  /**
   * Stop history query
   * @return {Promise<void>} - The result promise
   */
  async stop() {
    if (this.south) {
      this.logger.info(`Stopping south ${this.dataSource.name}`)
      await this.south.disconnect()
    }
    if (this.north) {
      this.logger.info(`Stopping north ${this.application.name}`)
      await this.north.disconnect()
    }
  }

  /**
   * Start the export step.
   * @return {Promise<void>} - The result promise
   */
  async startExport() {
    this.logger.info(`Start the export phase for HistoryQuery ${this.id}`)
    if (this.status !== HistoryQuery.STATUS_EXPORTING) {
      await this.setStatus(HistoryQuery.STATUS_EXPORTING)
    }

    this.dataSource.startTime = this.config.startTime
    this.dataSource.points = this.config.points
    this.dataSource[this.dataSource.protocol].query = this.config.query

    const { protocol, enabled, name } = this.dataSource
    this.south = enabled ? this.engine.createSouth(protocol, this.dataSource) : null
    if (this.south) {
      await this.south.connect()
      this.export()
    } else {
      this.logger.error(`South ${name} is not enabled or not found`)
      this.engine.runNextHistoryQuery()
    }
  }

  /**
   * Start the import step.
   * @return {Promise<void>} - The result promise
   */
  async startImport() {
    this.logger.info(`Start the import phase for HistoryQuery ${this.id}`)
    await this.finish()
    this.engine.runNextHistoryQuery()

    // if (this.status !== HistoryQuery.STATUS_IMPORTING) {
    //   await this.setStatus(HistoryQuery.STATUS_IMPORTING)
    // }

    // const { api, enabled, name } = this.application
    // this.north = enabled ? thi.createNorth(api, this.application) : null
    // if (this.north) {
    //   await this.north.connect()
    // } else {
    //   this.logger.error(`Application ${name} is enabled or not found`)
    //   this.engine.runNextHistoryQuery()
    // }
  }

  /**
   * Finish HistoryQuery.
   * @return {Promise<void>} - The result promise
   */
  async finish() {
    this.logger.info(`Finish HistoryQuery ${this.id}`)
    await this.setStatus(HistoryQuery.STATUS_FINISHED)
    await this.stop()
  }

  /**
   * Export data from South.
   * @return {Promise<void>} - The result promise
   */
  async export() {
    if (this.south.scanGroups) {
      // eslint-disable-next-line no-restricted-syntax
      for (const scanGroup of this.south.scanGroups) {
        const { scanMode } = scanGroup
        if (scanGroup.points && scanGroup.points.length) {
          // eslint-disable-next-line no-await-in-loop
          await this.exportScanMode(scanMode)
        } else {
          this.logger.error(`scanMode ${scanMode} ignored: scanGroup.points undefined or empty`)
        }
      }
    } else {
      await this.exportScanMode(this.dataSource.scanMode)
    }

    this.startImport()
  }

  /**
   * Export data from South for a given scanMode.
   * @param {string} scanMode - The scan mode to handle
   * @return {Promise<void>} - The result promise
   */
  async exportScanMode(scanMode) {
    let startTime = this.south.lastCompletedAt[scanMode]
    let intervalEndTime = this.endTime
    let firstIteration = true
    do {
      // Wait between the read interval iterations
      if (!firstIteration) {
        this.logger.silly(`Wait ${this.south.readIntervalDelay} ms`)
        // eslint-disable-next-line no-await-in-loop
        await this.south.delay(this.south.readIntervalDelay)
      }

      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests (for example only one hour if maxReadInterval is 3600)
      if ((this.endTime.getTime() - startTime.getTime()) > 1000 * this.south.maxReadInterval) {
        intervalEndTime = new Date(startTime.getTime() + 1000 * this.south.maxReadInterval)
      } else {
        intervalEndTime = this.endTime
      }

      // eslint-disable-next-line no-await-in-loop
      await this.south.historyQuery(scanMode, startTime, intervalEndTime)

      startTime = intervalEndTime
      firstIteration = false
    } while (intervalEndTime !== this.endTime)
  }

  setStatus(status) {
    this.status = status
    this.engine.configService.saveStatusForHistoryQuery(this.id, status)
  }
}

module.exports = HistoryQuery
