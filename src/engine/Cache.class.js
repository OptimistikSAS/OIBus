const fs = require('fs')
const path = require('path')

const sqlite3 = require('sqlite3')

/**
 * Local cache implementation to group events and store them when the communication with North is down.
 */
class Cache {
  /**
   * Constructor for Cache
   * @constructor
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(engine) {
    this.CACHE_TABLE_NAME = 'cache'

    this.engine = engine
    this.logger = engine.logger

    const { cacheFolder, archiveFolder, archiveMode } = engine.config.engine.caching

    // Create cache folder if not exists
    this.cacheFolder = path.resolve(cacheFolder)
    if (!fs.existsSync(this.cacheFolder)) {
      fs.mkdirSync(this.cacheFolder, { recursive: true })
    }

    // Create archive folder if not exists
    this.archiveFolder = path.resolve(archiveFolder)
    if (!fs.existsSync(this.archiveFolder)) {
      fs.mkdirSync(this.archiveFolder, { recursive: true })
    }

    this.archiveMode = archiveMode

    this.filesDatabase = this.createFilesDatabase('fileCache.db')

    this.activeApis = {}
  }

  /**
   * Initialize the cache by creating a database for every North application.
   * @param {object} applications - The North applications
   * @return {void}
   */
  initialize(applications) {
    Object.values(applications).forEach((application) => {
      const activeApi = {}

      activeApi.applicationId = application.application.applicationId
      activeApi.config = application.application.caching
      activeApi.canHandleValues = application.canHandleValues
      activeApi.canHandleFiles = application.canHandleFiles

      if (application.canHandleValues) {
        activeApi.database = this.createValuesDatabase(`${activeApi.applicationId}.db`)
      }

      this.resetTimeout(activeApi, activeApi.config.sendInterval)

      this.activeApis[activeApi.applicationId] = activeApi
    })
  }

  /**
   * Initiate SQLite3 database and create the cache table.
   * @param {string} filename - The filename to use for the database
   * @return {sqlite3.Database} - The SQLite3 database
   */
  createValuesDatabase(filename) {
    const databasePath = `${this.cacheFolder}/${filename}`
    const database = new sqlite3.Database(databasePath, (openError) => {
      if (openError) {
        this.logger.error(openError)
      } else {
        // Create cache table if not exists
        const query = `CREATE TABLE IF NOT EXISTS ${this.CACHE_TABLE_NAME} (
                        id INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                        data TEXT,
                        point_id TEXT
                     );`
        database.run(query, (createError) => {
          if (createError) {
            this.logger.error(createError)
          }
        })
      }
    })

    return database
  }

  /**
   * Initiate SQLite3 database and create the cache table.
   * @param {string} filename - The filename to use for the database
   * @return {sqlite3.Database} - The SQLite3 database
   */
  createFilesDatabase(filename) {
    const databasePath = `${this.cacheFolder}/${filename}`
    const database = new sqlite3.Database(databasePath, (openError) => {
      if (openError) {
        this.logger.error(openError)
      } else {
        // Create cache table if not exists
        const query = `CREATE TABLE IF NOT EXISTS ${this.CACHE_TABLE_NAME} (
                        id INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                        application TEXT,
                        path TEXT
                     );`
        database.run(query, (createError) => {
          if (createError) {
            this.logger.error(createError)
          }
        })
      }
    })

    return database
  }

  /**
   * Cache a new Value.
   * It will store the value in every database. If doNotCache is "true" it will immediately forward the value
   * to every North application.
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  cacheValues(value, doNotGroup) {
    Object.entries(this.activeApis).forEach(([applicationId, activeApi]) => {
      const { database, config, canHandleValues } = activeApi

      if (canHandleValues) {
        database.serialize(() => {
          const insertQuery = `INSERT INTO ${this.CACHE_TABLE_NAME} (timestamp, data, point_id) 
                             VALUES (?, ?, ?)`
          const entries = [value.timestamp, encodeURI(value.data), value.pointId]
          database.run(insertQuery, entries, (error) => {
            if (error) {
              this.logger.error(error)
            }
          })

          if (doNotGroup) {
            this.sendValues(applicationId, [value])
          } else {
            const countQuery = `SELECT COUNT(*) AS nr_entries
                                FROM ${this.CACHE_TABLE_NAME}`
            database.get(countQuery, (error, result) => {
              if (!error) {
                if (result.nr_entries >= config.groupCount) {
                  this.sendCallback(applicationId)
                }
              }
            })
          }
        })
      }
    })
  }

  /**
   * Cache the new raw file.
   * @param {String} filePath - The path of the raw file
   * @return {void}
   */
  cacheFile(filePath) {
    const timestamp = new Date().getTime()
    const cacheFilename = `${path.parse(filePath).name}-${timestamp}${path.parse(filePath).ext}`
    const cachePath = path.join(this.cacheFolder, cacheFilename)

    fs.rename(filePath, cachePath, (renameError) => {
      if (renameError) {
        this.logger.error(renameError)
      } else {
        Object.entries(this.activeApis).forEach(([applicationId, activeApi]) => {
          const { canHandleFiles } = activeApi

          if (canHandleFiles) {
            this.filesDatabase.serialize(() => {
              const insertQuery = `INSERT INTO ${this.CACHE_TABLE_NAME} (timestamp, application, path) 
                                   VALUES (?, ?, ?)`
              const entries = [timestamp, applicationId, cachePath]
              this.filesDatabase.run(insertQuery, entries, (insertError) => {
                if (insertError) {
                  this.logger.error(insertError)
                } else {
                  this.sendCallback(applicationId)
                }
              })
            })
          }
        })
      }
    })
  }

  /**
   * Get values to send to a given North application.
   * @param {string} applicationId - The application ID
   * @return {Promise} - The query status
   */
  getValuesToSend(applicationId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, timestamp, data, point_id AS pointId 
                     FROM ${this.CACHE_TABLE_NAME}
                     ORDER BY timestamp
                     LIMIT ${this.activeApis[applicationId].config.groupCount}`
      this.activeApis[applicationId].database.all(query, (error, results) => {
        if (error) {
          reject(error)
        } else {
          let values = null
          if (results.length > 0) {
            values = results.map((value) => {
              value.data = decodeURI(value.data)
              return value
            })
          }
          resolve(values)
        }
      })
    })
  }

  /**
   * Remove sent values from the cache for a given North application.
   * @param {string} applicationId - The application ID
   * @param {Object} values - The values to remove from the cache
   * @return {void}
   */
  removeSentValues(applicationId, values) {
    const ids = values.map(value => value.id).join()
    const query = `DELETE FROM ${this.CACHE_TABLE_NAME}
                   WHERE id IN (${ids})`
    this.activeApis[applicationId].database.run(query, (error) => {
      if (error) {
        this.logger.error(error)
      }
    })
  }

  /**
   * Get file to send to a given North application.
   * @param {string} applicationId - The application ID
   * @return {Promise} - The file read status
   */
  getFileToSend(applicationId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT path 
                     FROM ${this.CACHE_TABLE_NAME}
                     WHERE application = ?
                     ORDER BY timestamp
                     LIMIT 1`
      this.filesDatabase.all(query, [applicationId], (error, results) => {
        if (error) {
          reject(error)
        } else {
          let cachePath = null
          if (results.length > 0) {
            cachePath = results[0].path
          }
          resolve(cachePath)
        }
      })
    })
  }

  /**
   * Delete sent file from the cache for a given North application.
   * @param {string} applicationId - The application ID
   * @param {String} filePath - The file to delete from the cache
   * @return {void}
   */
  deleteSentFile(applicationId, filePath) {
    const query = `DELETE FROM ${this.CACHE_TABLE_NAME}
                   WHERE application = ?
                     AND path = ?`
    this.filesDatabase.run(query, [applicationId, filePath], (error) => {
      if (error) {
        this.logger.error(error)
      } else {
        this.handleSentFile(filePath)
      }
    })
  }

  /**
   * Callback function used by the timer to send the values to the given North application.
   * @param {string} applicationId - The application ID
   * @return {void}
   */
  sendCallback(applicationId) {
    const application = this.activeApis[applicationId]

    if (application.canHandleValues) {
      this.handleValues(application)
    }

    if (application.canHandleFiles) {
      this.handleFiles(application)
    }
  }

  /**
   * Handle value resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async handleValues(application) {
    let success = true

    try {
      const values = await this.getValuesToSend(application.applicationId)

      if (values) {
        success = await this.sendValues(application.applicationId, values)
      }
    } catch (error) {
      this.logger.error(error)
      success = false
    }

    const timeout = success ? application.config.sendInterval : application.config.retryInterval
    this.resetTimeout(application, timeout)
  }

  /**
   * Handle files resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async handleFiles(application) {
    let success = true

    try {
      const filePath = await this.getFileToSend(application.applicationId)

      if (filePath) {
        success = await this.engine.sendFile(application.applicationId, filePath)

        if (success) {
          this.deleteSentFile(application.applicationId, filePath)
        }
      }
    } catch (error) {
      this.logger.error(error)
      success = false
    }

    const timeout = success ? application.config.sendInterval : application.config.retryInterval
    this.resetTimeout(application, timeout)
  }

  /**
   * Send values to a given North application.
   * @param {string} applicationId - The application ID
   * @param {object[]} values - The values to send
   * @return {void}
   */
  async sendValues(applicationId, values) {
    const success = await this.engine.sendValues(applicationId, values)

    if (success) {
      this.removeSentValues(applicationId, values)
    }

    return success
  }

  /**
   * Remove file if it was sent to all North.
   * @param {string} filePath - The file
   * @return {void}
   */
  handleSentFile(filePath) {
    const query = `SELECT COUNT(*) AS count 
                   FROM ${this.CACHE_TABLE_NAME}
                   WHERE path = ?`
    this.filesDatabase.get(query, [filePath], (selectError, result) => {
      if (selectError) {
        this.logger.error(selectError)
      } else if (result.count === 0) {
        const archivedFilename = path.basename(filePath)
        const archivePath = path.join(this.archiveFolder, archivedFilename)

        switch (this.archiveMode) {
          case 'delete':
            // Delete original file
            fs.unlink(filePath, (error) => {
              if (error) {
                this.logger.error(error)
              } else {
                this.logger.info(`File ${filePath} deleted`)
              }
            })
            break
          case 'archive':
            // Create archive folder if it doesn't exist
            if (!fs.existsSync(this.archiveFolder)) {
              fs.mkdirSync(this.archiveFolder, { recursive: true })
            }

            // Move original file into the archive folder
            fs.rename(filePath, archivePath, (renameError) => {
              if (renameError) {
                this.logger.error(renameError)
              } else {
                this.logger.info(`File ${filePath} moved to ${archivePath}`)
              }
            })
            break
          default:
        }
      }
    })
  }

  /**
   * Reset application timer.
   * @param {object} application - The application
   * @param {number} timeout - The timeout interval
   * @return {void}
   */
  resetTimeout(application, timeout) {
    if (application.timeout) {
      clearTimeout(application.timeout)
    }
    application.timeout = setTimeout(
      this.sendCallback.bind(this, application.applicationId),
      timeout,
    )
  }
}

module.exports = Cache
