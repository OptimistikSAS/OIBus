const fs = require('node:fs/promises')
const path = require('node:path')

const { createFolder } = require('../utils')

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000 // one hour
const ARCHIVE_FOLDER = 'archive'

/**
 * Archive service used to archive sent file and check periodically the archive folder to remove old files
 * Once a file is sent by a North connector, the archiveOrRemoveFile is called by the connector to manage the file
 */
class ArchiveService {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder generated as north-connectorId. This base folder can
   * be in data-stream or history-query folder depending on the connector use case
   * @param {Boolean} enabled - If the archive mode for this North connector is enabled
   * @param {Number} retentionDuration - File retention duration in archive folder (in hours)
   * @return {void}
   */
  constructor(
    northId,
    logger,
    baseFolder,
    enabled,
    retentionDuration,
  ) {
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
    this.enabled = enabled
    // Convert from hours to ms to compare with mtimeMs (file modified time in ms)
    this.retentionDuration = retentionDuration * 3600000
    this.archiveFolder = path.resolve(this.baseFolder, ARCHIVE_FOLDER)
    this.archiveTimeout = null
  }

  /**
   * Create folders and activate archive cleanup if needed
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    await createFolder(this.archiveFolder)
    // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
    if (this.enabled && this.retentionDuration > 0) {
      this.refreshArchiveFolder()
    }
  }

  /**
   * Stop the archive timeout and close the databases
   * @return {void}
   */
  async stop() {
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }
  }

  /**
   * Remove file from North connector cache and place it to archive folder if enabled.
   * @param {String} filePathInCache - The file to remove
   * @return {Promise<void>} - The result promise
   */
  async archiveOrRemoveFile(filePathInCache) {
    if (this.enabled) {
      const filenameInfo = path.parse(filePathInCache)
      const archivePath = path.join(this.archiveFolder, filenameInfo.base)
      // Move cache file into the archive folder
      try {
        await fs.rename(filePathInCache, archivePath)
        this.logger.debug(`File "${filePathInCache}" moved to "${archivePath}".`)
      } catch (renameError) {
        this.logger.error(renameError)
      }
    } else {
      // Delete original file
      try {
        await fs.unlink(filePathInCache)
        this.logger.debug(`File "${filePathInCache}" removed from disk.`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   * @return {void}
   */
  async refreshArchiveFolder() {
    this.logger.debug('Parse archive folder to remove old files.')
    // If a timeout already runs, clear it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }

    let files = []
    try {
      files = await fs.readdir(this.archiveFolder)
    } catch (error) {
      // If the archive folder doest not exist (removed by the user for example), an error is logged
      this.logger.error(error)
    }
    if (files.length > 0) {
      const referenceDate = new Date().getTime()

      // Map each file to a promise and remove files sequentially
      await files.reduce((promise, file) => promise.then(
        async () => this.removeFileIfTooOld(file, referenceDate, this.archiveFolder),
      ), Promise.resolve())
    } else {
      this.logger.debug(`The archive folder "${this.archiveFolder}" is empty. Nothing to delete.`)
    }
    this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT)
  }

  /**
   * Check the modified time of a file and remove it if older than the retention duration
   * @param {String} filename - The name of the file to remove
   * @param {Number} referenceDate - The reference date (in ms)
   * @param {String} archiveFolder - The archive folder
   * @returns {Promise<void>} - The result promise
   */
  async removeFileIfTooOld(filename, referenceDate, archiveFolder) {
    let stats
    try {
      // If a file is being written or corrupted, the stat method can fail an error is logged
      stats = await fs.stat(path.join(archiveFolder, filename))
    } catch (error) {
      this.logger.error(error)
    }
    if (stats && stats.mtimeMs + this.retentionDuration < referenceDate) {
      try {
        await fs.unlink(path.join(archiveFolder, filename))
        this.logger.debug(`File "${path.join(archiveFolder, filename)}" removed from archive.`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }
}

module.exports = ArchiveService
