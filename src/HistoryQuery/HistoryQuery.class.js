const path = require('node:path')

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

    this.cacheFolder = path.resolve(this.engine.cacheFolder, historySettings.id)

    this.statusService = null
    this.finishInterval = null
  }

  /**
   * Run history query according to its status
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    this.statusService = new StatusService()
    this.statusService.updateStatusDataStream({ status: this.historySettings.status })
    await createFolder(this.cacheFolder)
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

    if (!this.south.connected || !this.north.connected) {
      throw new Error('Connection failed.')
    }
    this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL)

    this.setStatus(HistoryQuery.STATUS_RUNNING)
    this.statusService.updateStatusDataStream({ status: HistoryQuery.STATUS_RUNNING })

    // In the south.init method, queryParts is set for each scanMode to 0
    // Because of scan groups, associated to aggregates, each scan mode must be queried independently
    // Map each scanMode to a history query and run each query sequentially
    await Object.keys(this.south.queryParts).reduce((promise, scanMode) => promise.then(
      async () => this.south.historyQueryHandler(scanMode, this.startTime, this.endTime),
    ), Promise.resolve())
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

  /**
   * Overwrite connector settings with history specific settings
   * @return {void}
   */
  overwriteConnectorsSettings() {
    // Overwrite some parameters for history query
    this.north.baseFolder = path.resolve(this.cacheFolder, `north-${this.north.settings.id}`)
    this.south.baseFolder = path.resolve(this.cacheFolder, `south-${this.south.settings.id}`)
    this.south.filename = this.filePattern
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
    const extractionDone = Object.values(this.south.queryParts).every((queryPart) => queryPart >= this.south.maxQueryPart)

    if (!extractionDone) {
      this.logger.trace(`History query "${this.historySettings.id}" not over yet: Data extraction still ongoing for "${this.southSettings.name}".`)
      return
    }

    if (!this.north.isCacheEmpty()) {
      this.logger.trace(`History query "${this.historySettings.id}" not over yet: Data cache not empty for "${this.northSettings.name}".`)
      return
    }

    this.logger.info(`Finish "${this.southSettings.name}" -> "${this.northSettings.name}" (${this.historySettings.id})`)
    this.statusService.updateStatusDataStream({ status: HistoryQuery.STATUS_FINISHED })
    await this.stop()
    await this.setStatus(HistoryQuery.STATUS_FINISHED)
  }

  /**
   * Set new status for HistoryQuery
   * @param {string} status - The new status
   * @return {void}
   */
  async setStatus(status) {
    this.historySettings.status = status
    this.engine.historyQueryRepository.update(this.historySettings)
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
