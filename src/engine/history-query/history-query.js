const path = require('node:path')

const StatusService = require('../../service/status.service')
const { createFolder } = require('../../service/utils')

const FINISH_INTERVAL = 5000

class HistoryQuery {
  // Waiting to be started
  static STATUS_PENDING = 'pending'

  // Exporting data from south and sending them to north
  static STATUS_RUNNING = 'running'

  // History query finished
  static STATUS_FINISHED = 'finished'

  constructor(engine, historyConfiguration, southConfiguration, northConfiguration, logger) {
    this.engine = engine
    this.logger = logger
    this.historyConfiguration = historyConfiguration
    this.southConfiguration = southConfiguration
    this.south = null
    this.northConfiguration = northConfiguration
    this.north = null
    this.startTime = new Date(historyConfiguration.startTime)
    this.endTime = new Date(historyConfiguration.endTime)
    this.filePattern = historyConfiguration.filePattern

    this.cacheFolder = path.resolve(this.engine.cacheFolder, historyConfiguration.id)

    this.statusService = null
    this.finishInterval = null
  }

  /**
   * Run history query according to its status
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    this.statusService = new StatusService()
    this.statusService.updateStatusDataStream({ status: this.historyConfiguration.status })
    await createFolder(this.cacheFolder)
    this.south = this.engine.createSouth(this.southConfiguration, this.logger)
    if (!this.south) {
      this.logger.error(`South connector "${this.southConfiguration.name}" is not found. `
          + `Disabling history query "${this.historyConfiguration.id}".`)
      await this.disable()
      return
    }
    if (!this.south.supportedModes.supportHistory) {
      this.logger.error(`South connector "${this.southConfiguration.name}" does not support history queries. `
          + `Disabling history query "${this.historyConfiguration.id}".`)
      await this.disable()
      return
    }
    this.north = this.engine.createNorth(this.northConfiguration, this.logger)
    if (!this.north) {
      this.logger.error(`North connector "${this.northConfiguration.name}" is not found. `
          + `Disabling history query "${this.historyConfiguration.id}".`)
      await this.disable()
      return
    }

    this.overwriteConnectorsSettings()

    await this.north.start(
      path.resolve(this.cacheFolder, `north-${this.north.id}`),
      this.engine.oibusName,
      this.engine.defaultLogParameters,
    )
    await this.north.connect()

    await this.south.start(
      path.resolve(this.cacheFolder, `south-${this.south.id}`),
      this.engine.oibusName,
      this.engine.defaultLogParameters,
    )
    await this.south.connect()

    if (!this.south.connected || !this.north.connected) {
      throw new Error('Connection failed.')
    }
    this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL)

    this.setStatus(HistoryQuery.STATUS_RUNNING)
    this.statusService.updateStatusDataStream({ status: HistoryQuery.STATUS_RUNNING })

    // In the south.start method, queryParts is set for each scanMode to 0
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
      this.logger.info(`Stopping South connector "${this.southConfiguration.name}".`)
      await this.south.stop()
    }
    if (this.north) {
      this.logger.info(`Stopping North connector "${this.northConfiguration.name}".`)
      await this.north.stop()
    }
    this.statusService.stop()
  }

  /**
   * Overwrite connector settings with history specific settings
   * @return {void}
   */
  overwriteConnectorsSettings() {
    // Overwrite some parameters for history query
    this.south.filename = this.filePattern
    this.south.startTime = this.historyConfiguration.startTime
    this.south.points = this.historyConfiguration.settings.points
    this.south.query = this.historyConfiguration.settings.query
    this.south.maxReadInterval = this.historyConfiguration.settings.maxReadInterval
    this.south.readIntervalDelay = this.historyConfiguration.settings.readIntervalDelay
    this.south.name = `${this.southConfiguration.name}-${this.northConfiguration.name}`
  }

  /**
   * Finish HistoryQuery.
   * @return {Promise<void>} - The result promise
   */
  async finish() {
    const extractionDone = Object.values(this.south.queryParts).every((queryPart) => queryPart >= this.south.maxQueryPart)

    if (!extractionDone) {
      this.logger.trace(`History query "${this.historyConfiguration.id}" not over yet: `
          + `Data extraction still ongoing for "${this.southConfiguration.name}".`)
      return
    }

    const isCacheEmpty = await this.north.isCacheEmpty()
    if (!isCacheEmpty) {
      this.logger.trace(`History query "${this.historyConfiguration.id}" not over yet: Data cache not empty for "${this.northConfiguration.name}".`)
      return
    }

    this.logger.info(`Finish "${this.southConfiguration.name}" -> "${this.northConfiguration.name}" (${this.historyConfiguration.id})`)
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
    this.historyConfiguration.status = status
    this.engine.historyQueryRepository.update(this.historyConfiguration)
  }

  /**
   * Disable HistoryQuery
   * @return {void}
   */
  async disable() {
    this.historyConfiguration.enabled = false
    this.engine.historyQueryRepository.update(this.historyConfiguration)
  }
}

module.exports = HistoryQuery
