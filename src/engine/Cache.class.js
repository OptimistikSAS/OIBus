const fs = require('fs')
const sqlite3 = require('sqlite3')

/**
 * Local cache implementation to store events when the communication with north is down.
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

    // Create cache folder if not exists
    this.cacheFolder = engine.config.engine.caching.cacheFolder
    if (!fs.existsSync(this.cacheFolder)) {
      fs.mkdirSync(this.cacheFolder, { recursive: true })
    }

    this.activeApis = {}
  }

  /**
   * Initialize the cache by creating a database for every North application.
   * @param {object} applications - The North applications
   * @return {void}
   */
  initialize(applications) {
    applications.forEach((application) => {
      const activeApi = {}

      activeApi.applicationId = application.application.applicationId
      activeApi.database = this.createDatabase(`${activeApi.applicationId}.db`)
      activeApi.config = application.application.caching
      activeApi.timeout = setTimeout(
        this.sendCallback.bind(this, activeApi.applicationId),
        activeApi.config.sendInterval,
      )

      this.activeApis[activeApi.applicationId] = activeApi
    })
  }

  /**
   * Initiate SQLite3 database and create the cache table.
   * @param {string} filename - The filename to use for the database
   * @return {sqlite3.Database} - The SQLite3 database
   */
  createDatabase(filename) {
    const databasePath = `${this.cacheFolder}/${filename}`
    const database = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        this.logger.error(error.message)
      } else {
        // Create cache table if not exists
        const query = `CREATE TABLE IF NOT EXISTS ${this.CACHE_TABLE_NAME} (
                        id INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                        data TEXT,
                        point_id TEXT
                     );`
        database.run(query)
      }
    })

    return database
  }

  /**
   * Cache a new Value.
   * It will store the value.
   * If doNotCache is "true" it will immediately .
   * Otherwise the Value will be cached and sent back later.
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  cacheValues(value, doNotGroup) {
    Object.keys(this.activeApis).forEach((applicationId) => {
      const database = this.activeApis[applicationId]

      database.serialize(() => {
        const insertQuery = `INSERT INTO ${this.CACHE_TABLE_NAME} (timestamp, data, point_id) VALUES (?, ?, ?)`
        const entries = [value.timestamp, encodeURI(value.data), value.pointId]
        database.run(insertQuery, entries, (error) => {
          this.logger.error(error)
        })

        if (doNotGroup) {
          this.sendValues(applicationId, [value])
        } else {
          const countQuery = `SELECT COUNT(*) AS nr_entries
                              FROM ${this.CACHE_TABLE_NAME}`
          database.get(countQuery, (error, result) => {
            if (!error) {
              if (result.nr_entries >= this.activeApis.config.groupCount) {
                this.sendCallback(applicationId)
              }
            }
          })
        }
      })
    })
  }

  /**
   * Get values to send.
   * @param {string} applicationId - The application ID
   * @return {Promise} - The query status
   */
  getValuesToSend(applicationId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, timestamp, data, point_id AS pointId 
                     FROM ${this.CACHE_TABLE_NAME}
                     ORDER BY timestamp
                     LIMIT ${this.activeApis[applicationId].config.resendCount}`
      this.activeApis[applicationId].database.all(query, (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }

  /**
   * Remove sent values from the cache.
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
   * Callback function used by the timer to send the values.
   * @param {string} applicationId - The application ID
   * @return {void}
   */
  sendCallback(applicationId) {
    let timeout = this.activeApis[applicationId].config.sendInterval

    this.getValuesToSend(applicationId)
      .then((values) => {
        if (values.length > 0) {
          // Decode values
          const decodedValues = values.map((value) => {
            value.data = decodeURI(value.data)
            return value
          })

          // Send the values
          this.engine.sendValues(applicationId, decodedValues)
            .then((success) => {
              if (success) {
                this.removeSentValues(applicationId, values)
              } else {
                timeout = this.activeApis[applicationId].config.retryInterval
              }
            })
        }

        // Re-activate the send timer
        this.activeApis[applicationId].timeout = setTimeout(
          this.sendCallback.bind(this, applicationId),
          timeout,
        )
      })
      .catch((error) => {
        this.logger.error(error.stack)

        this.activeApis[applicationId].timeout = setTimeout(
          this.sendCallback.bind(this, applicationId),
          timeout,
        )
      })
  }

  /**
   * Send values to North application
   * @param {string} applicationId - The application ID
   * @param {object[]} values - The values to send
   * @return {void}
   */
  sendValues(applicationId, values) {
    this.engine.sendValues(applicationId, values)
      .then((success) => {
        if (success) {
          this.removeSentValues(applicationId, values)
        }
      })
  }
}

module.exports = Cache
