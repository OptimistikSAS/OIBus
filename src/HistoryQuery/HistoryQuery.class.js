const StatusService = require('../services/status.service.class')
const { createFolder } = require('../services/utils')

const FINISH_INTERVAL = 5000

class HistoryQuery {
  // Waiting to be started
  static STATUS_PENDING = 'pending'

  // Exporting data from south and sending them to north
  static STATUS_RUNNING = 'running'

  // History query finished
  static STATUS_FINISHED = 'finished'

  // The folder to store the files during the export
  static DATA_FOLDER = 'data'

  // The folder to store the imported files
  static IMPORTED_FOLDER = 'imported'

  // The folder to store files not able to import
  static ERROR_FOLDER = 'error'

  constructor(engine, historySettings, southSettings, northSettings) {
    this.engine = engine
    this.logger = engine.logger
    this.historySettings = historySettings
    this.southSettings = southSettings
    this.south = null
    this.northSettings = northSettings
    this.north = null
    this.startTime = new Date(historySettings.startTime)
    this.endTime = new Date(historySettings.endTime)
    this.filePattern = historySettings.filePattern
    this.cacheFolder = `${this.engine.cacheFolder}/${historySettings.id}`
    this.dataCacheFolder = `${this.engine.cacheFolder}/${historySettings.id}/${HistoryQuery.DATA_FOLDER}`

    this.statusService = new StatusService()
    this.statusService.updateStatusDataStream({ status: historySettings.status })
    this.finishInterval = null
  }

  /**
   * Run history query according to its status
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    await createFolder(this.cacheFolder)
    await createFolder(this.dataCacheFolder)
    this.south = this.engine.createSouth(this.southSettings)
    if (!this.south) {
      this.logger.error(`South connector "${this.southSettings.name}" is not found. `
          + `Disabling history query "${this.historySettings.id}".`)
      await this.disable()
      return
    }
    if (!this.south.supportedModes.supportHistory) {
      this.logger.error(`South connector "${this.southSettings.name}" does not support history queries. `
          + `Disabling history query "${this.historySettings.id}".`)
      await this.disable()
      return
    }
    this.north = this.engine.createNorth(this.northSettings)
    if (!this.north) {
      this.logger.error(`North connector "${this.northSettings.name}" is not found. `
          + `Disabling history query "${this.historySettings.id}".`)
      await this.disable()
      return
    }

    this.overwriteConnectorsSettings()

    await this.north.init()
    await this.north.connect()

    await this.south.init()
    await this.south.connect()

    this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL)

    // In the south.init method, queryParts is set for each scanMode to 0
    // Because of scan groups, associated to aggregates, each scan mode must be queried independently
    // Map each scanMode to a history query and run each query sequentially
    try {
      await Object.keys(this.south.queryParts).reduce((promise, scanMode) => promise.then(
        async () => this.south.historyQueryHandler(scanMode, this.startTime, this.endTime),
      ), Promise.resolve())
    } catch (err) {
      this.logger.error(err)
      await this.stop()
    }
  }

  /**
   * Stop history query
   * @return {Promise<void>} - The result promise
   */
  async stop() {
    if (this.finishInterval) {
      clearInterval(this.finishInterval)
    }
    if (this.south) {
      this.logger.info(`Stopping South connector "${this.southSettings.name}".`)
      await this.south.disconnect()
    }
    if (this.north) {
      this.logger.info(`Stopping North connector "${this.northSettings.name}".`)
      await this.north.disconnect()
    }
    this.statusService.stop()
  }

  overwriteConnectorsSettings() {
    // Overwrite some parameters for history query
    this.south.filename = this.filePattern
    this.south.tmpFolder = this.dataCacheFolder
    this.south.settings.startTime = this.historySettings.startTime
    this.south.points = this.historySettings.settings.points
    this.south.query = this.historySettings.settings.query
    this.south.maxReadInterval = this.historySettings.settings.maxReadInterval
    this.south.readIntervalDelay = this.historySettings.settings.readIntervalDelay
    this.south.name = `${this.southSettings.name}-${this.northSettings.name}`
  }

  /**
   * Finish HistoryQuery.
   * @return {Promise<void>} - The result promise
   */
  async finish() {
    const extractionDone = Object.values(this.south.queryParts).every((queryPart) => queryPart === this.south.maxQueryPart)

    if (!extractionDone) {
      this.logger.trace(`History query "${this.historySettings.id}" not over yet: Data extraction still ongoing for "${this.southSettings.name}".`)
      return
    }

    if (!this.north.isCacheEmpty()) {
      this.logger.trace(`History query "${this.historySettings.id}" not over yet: Data cache not empty for "${this.northSettings.name}".`)
      return
    }

    this.logger.info(`Finish "${this.southSettings.name}" -> "${this.northSettings.name}" (${this.historySettings.id})`)
    await this.setStatus(HistoryQuery.STATUS_FINISHED)
    await this.stop()
    await this.engine.runNextHistoryQuery()
  }

  /**
   * Set new status for HistoryQuery
   * @param {string} status - The new status
   * @return {void}
   */
  async setStatus(status) {
    this.historySettings.status = status
    this.engine.historyQueryRepository.update(this.historySettings)
    this.statusService.updateStatusDataStream({ status })
  }

  /**
   * Disable HistoryQuery
   * @return {void}
   */
  async disable() {
    this.historySettings.enabled = false
    this.engine.historyQueryRepository.update(this.historySettings)
  }
}

module.exports = HistoryQuery
