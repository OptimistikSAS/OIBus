/* eslint-disable no-await-in-loop */

import fs from 'node:fs/promises'
import path from 'node:path'
import EventEmitter from 'node:events'

import ApiHandler from '../north/ApiHandler.class.js'

export default class HistoryQuery {
  // Waiting to be started
  static STATUS_PENDING = 'pending'

  // Exporting data from south
  static STATUS_EXPORTING = 'exporting'

  // Importing data into North
  static STATUS_IMPORTING = 'importing'

  // History query finished
  static STATUS_FINISHED = 'finished'

  // The folder to store the files during the export
  static DATA_FOLDER = 'data'

  // The folder to store the imported files
  static IMPORTED_FOLDER = 'imported'

  // The folder to store files not able to import
  static ERROR_FOLDER = 'error'

  constructor(engine, logger, config, dataSource, application) {
    this.engine = engine
    this.logger = logger
    this.config = config
    this.id = config.id
    this.status = config.status
    this.dataSource = dataSource
    this.south = null
    this.application = application
    this.north = null
    this.startTime = new Date(config.startTime)
    this.endTime = new Date(config.endTime)
    this.filePattern = config.filePattern
    this.cacheFolder = `${this.engine.cacheFolder}/${this.id}`
    this.dataCacheFolder = `${this.engine.cacheFolder}/${this.id}/${HistoryQuery.DATA_FOLDER}`
    this.statusData = {}
    this.numberOfQueryParts = Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * this.config.settings.maxReadInterval))

    if (!this.engine.eventEmitters[`/history/${this.id}/sse`]) {
      this.engine.eventEmitters[`/history/${this.id}/sse`] = {}
    } else {
      this.engine.eventEmitters[`/history/${this.id}/sse`].events.removeAllListeners()
      this.engine.eventEmitters[`/history/${this.id}/sse`].stream?.destroy()
    }
    this.engine.eventEmitters[`/history/${this.id}/sse`].events = new EventEmitter()
    this.engine.eventEmitters[`/history/${this.id}/sse`].events.on('data', this.listener)
    this.updateStatusDataStream({ status: this.status })
  }

  /**
   * Start history query
   * @returns {void}
   */
  async start() {
    await HistoryQuery.createFolder(this.cacheFolder)
    await HistoryQuery.createFolder(this.dataCacheFolder)
    switch (this.status) {
      case HistoryQuery.STATUS_PENDING:
      case HistoryQuery.STATUS_EXPORTING:
        await this.startExport()
        break
      case HistoryQuery.STATUS_IMPORTING:
        await this.startImport()
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
    this.engine.eventEmitters[`/history/${this.id}/sse`]?.events?.removeAllListeners()
    this.engine.eventEmitters[`/history/${this.id}/sse`]?.stream?.destroy()
  }

  /**
   * Start the export step.
   * @return {Promise<void>} - The result promise
   */
  async startExport() {
    this.logger.info(`Start the export phase for HistoryQuery ${this.dataSource.name} -> ${this.application.name} (${this.id})`)

    if (this.status !== HistoryQuery.STATUS_EXPORTING) {
      await this.setStatus(HistoryQuery.STATUS_EXPORTING)
    }

    const { protocol, name } = this.dataSource
    this.south = this.engine.createSouth(protocol, this.dataSource)
    if (this.south) {
      // override some parameters for history query
      this.south.filename = this.filePattern
      this.south.tmpFolder = this.dataCacheFolder
      this.south.dataSource.startTime = this.config.startTime
      this.south.points = this.config.settings.points
      this.south.query = this.config.settings.query
      this.south.maxReadInterval = this.config.settings.maxReadInterval
      this.south.readIntervalDelay = this.config.settings.readIntervalDelay
      this.south.name = `${this.dataSource.name}-${this.application.name}`
      await this.south.init()
      await this.south.connect()
      if (this.south.connected) {
        await this.export()
      } else {
        await this.disable()
        this.logger.error(`Could not connect to south connector ${
          this.south.dataSource.name
        }. This history query has been disabled. Check the connection before enabling it again.`)
      }
    } else {
      this.logger.error(`South connector "${name}" is not found (history query ${this.id})`)
      await this.disable()
      this.engine.runNextHistoryQuery()
    }
  }

  /**
   * Start the import step.
   * @return {Promise<void>} - The result promise
   */
  async startImport() {
    this.logger.info(`Start the import phase for HistoryQuery ${this.dataSource.name} -> ${this.application.name} (${this.id})`)

    if (this.status !== HistoryQuery.STATUS_IMPORTING) {
      await this.setStatus(HistoryQuery.STATUS_IMPORTING)
    }

    const {
      api,
      name,
    } = this.application
    this.north = this.engine.createNorth(api, this.application)
    if (this.north) {
      await this.north.init()
      await this.north.connect()
      if (this.north.connected) {
        await this.import()
      } else {
        await this.disable()
        this.logger.error(`Could not connect to north connector ${
          this.north.application.name
        }. This history query has been disabled. Check the connection before enabling it again.`)
      }
    } else {
      this.logger.error(`North connector "${name}" is not found (history query ${this.id})`)
      await this.disable()
      this.engine.runNextHistoryQuery()
    }
  }

  /**
   * Finish HistoryQuery.
   * @return {Promise<void>} - The result promise
   */
  async finish() {
    this.logger.info(`Finish HistoryQuery ${this.dataSource.name} -> ${this.application.name} (${this.id})`)
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
          this.updateStatusDataStream({ scanGroup: `${scanGroup.scanMode} - ${scanGroup.aggregate}` })
          // eslint-disable-next-line no-await-in-loop
          const exportResult = await this.exportScanMode(scanMode)
          if (exportResult === -1) {
            this.logger.trace('exportScanMode failed. Leaving export method.')
            return
          }
        } else {
          this.logger.error(`scanMode ${scanMode} ignored: scanGroup.points undefined or empty`)
        }
      }
      this.updateStatusDataStream({ scanGroup: null })
    } else {
      const exportResult = await this.exportScanMode(this.dataSource.scanMode)
      if (exportResult === -1) {
        this.logger.trace('exportScanMode failed. Leaving export method.')
        return
      }
    }

    await this.startImport()
  }

  /**
   * Import data into North.
   * @return {Promise<void>} - The result promise
   */
  async import() {
    let files = []
    try {
      this.logger.trace(`Reading ${this.dataCacheFolder} directory`)
      files = await fs.readdir(this.dataCacheFolder)
    } catch (error) {
      this.logger.error(`Could not read folder ${this.dataCacheFolder} - error: ${error})`)
      return
    }

    // Filter out directories
    files = files.filter(async (filename) => {
      const stats = await fs.stat(path.join(this.dataCacheFolder, filename))
      return stats.isFile()
    })
    if (files.length === 0) {
      this.logger.debug(`No files in ${this.dataCacheFolder}`)
      return
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const filename of files) {
      const filePath = path.join(this.dataCacheFolder, filename)
      let status
      try {
        status = await this.north.handleFile(filePath)
      } catch (error) {
        status = error
      }

      const archiveFolder = path.join(this.cacheFolder, HistoryQuery.IMPORTED_FOLDER)
      const errorFolder = path.join(this.cacheFolder, HistoryQuery.ERROR_FOLDER)
      if (status === ApiHandler.STATUS.SUCCESS) {
        await HistoryQuery.createFolder(archiveFolder)
        await fs.rename(filePath, path.join(this.cacheFolder, HistoryQuery.IMPORTED_FOLDER, filename))
      } else {
        await HistoryQuery.createFolder(errorFolder)
        await fs.rename(filePath, path.join(this.cacheFolder, HistoryQuery.ERROR_FOLDER, filename))
      }
    }

    await this.finish()
  }

  /**
   * Export data from South for a given scanMode.
   * @param {string} scanMode - The scan mode to handle
   * @return {Promise<number>} - The history query result: -1 if an error occurred, 0 otherwise
   */
  async exportScanMode(scanMode) {
    let startTime = this.south.lastCompletedAt[scanMode]

    let intervalEndTime
    let firstIteration = true
    do {
      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests (for example only one hour if maxReadInterval is 3600)
      if (this.south.maxReadInterval > 0 && (this.endTime.getTime() - startTime.getTime()) > 1000 * this.south.maxReadInterval) {
        intervalEndTime = new Date(startTime.getTime() + 1000 * this.south.maxReadInterval)
      } else {
        intervalEndTime = this.endTime
      }
      this.updateStatusDataStream({
        currentTime: startTime.toISOString(),
        progress: Math.round((this.south.queryParts[scanMode] / this.numberOfQueryParts) * 10000) / 100,
      })

      // Wait between the read interval iterations
      if (!firstIteration) {
        this.logger.trace(`Wait ${this.south.readIntervalDelay} ms`)
        // eslint-disable-next-line no-await-in-loop
        await this.south.delay(this.south.readIntervalDelay)
      }

      // eslint-disable-next-line no-await-in-loop
      const historyQueryResult = await this.south.historyQuery(scanMode, startTime, intervalEndTime)

      if (historyQueryResult === -1) {
        this.logger.error(`Error while retrieving data. Exiting historyQueryHandler. startTime: ${
          startTime.toISOString()}, intervalEndTime: ${intervalEndTime.toISOString()}`)
        return -1
      }

      startTime = intervalEndTime
      this.south.queryParts[scanMode] += 1
      // eslint-disable-next-line no-await-in-loop
      await this.south.setConfig(`queryPart-${scanMode}`, this.south.queryParts[scanMode])
      firstIteration = false
    } while (intervalEndTime !== this.endTime)
    this.south.queryParts[scanMode] = 0
    // eslint-disable-next-line no-await-in-loop
    await this.south.setConfig(`queryPart-${scanMode}`, this.south.queryParts[scanMode])
    this.updateStatusDataStream({
      currentTime: startTime.toISOString(),
      progress: 100,
    })
    return 0
  }

  /**
   * Set new status for HistoryQuery
   * @param {string} status - The new status
   * @return {void}
   */
  async setStatus(status) {
    this.status = status
    this.config.status = status
    await this.engine.historyQueryRepository.update(this.config)
    this.updateStatusDataStream({ status })
  }

  /**
   * Disable HistoryQuery
   * @return {void}
   */
  async disable() {
    this.config.enabled = false
    await this.engine.historyQueryRepository.update(this.config)
  }

  /**
   * Create folder if not exists
   * @param {string} folder - The folder to create
   * @return {Promise<void>} - The result promise
   */
  static async createFolder(folder) {
    const folderPath = path.resolve(folder)
    try {
      await fs.stat(folderPath)
    } catch (error) {
      await fs.mkdir(folderPath, { recursive: true })
    }
  }

  /**
   * Method used by the eventEmitter of the current protocol to write data to the socket and send them to the frontend
   * @param {object} data - The json object of data to send
   * @return {void}
   */
  listener = (data) => {
    if (data) {
      this.engine.eventEmitters[`/history/${this.id}/sse`]?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  updateStatusDataStream(statusData = {}) {
    this.statusData = { ...this.statusData, ...statusData }
    this.engine.eventEmitters[`/history/${this.id}/sse`].statusData = this.statusData
    this.engine.eventEmitters[`/history/${this.id}/sse`]?.events?.emit('data', this.statusData)
  }
}
