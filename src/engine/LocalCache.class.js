const fs = require('fs')
const sqlite3 = require('sqlite3')

/**
 * Local cache implementation to store events when the communication with north is down.
 */
class LocalCache {
  /**
   * Constructor for LocalCache
   * @constructor
   * @param {Engine} engine - The Engine
   * @param {ApiHandler} application - The north application
   * @return {void}
   */
  constructor(engine, application) {
    this.CACHE_TABLE_NAME = 'cache'

    this.application = application
    this.logger = engine.logger
    this.config = Object.assign({}, engine.config.engine.caching)

    if (this.application.application.caching && this.application.application.caching.resendCount) {
      this.config.resendCount = this.application.application.caching.resendCount
    }

    // Initiate resending timer with retryInterval
    const timeout = 1000 * this.config.retryInterval
    this.timeout = setTimeout(this.sendCallback.bind(this), timeout)

    // Create cache folder if not exists
    if (!fs.existsSync(this.config.cacheFolder)) {
      fs.mkdirSync(this.config.cacheFolder, { recursive: true })
    }

    // Initiate SQLite database
    const databasePath = `${this.config.cacheFolder}/${this.application.application.applicationId}.db`
    this.database = new sqlite3.Database(databasePath, (error) => {
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
        this.database.run(query)
      }
    })
  }

  /**
   * Cache new Values.
   * The Values will be stored in the memory and sent back to Application for re-sending
   * after retryInterval or resendInterval is reached.
   * @param {object} values - The new values
   * @return {void}
   */
  cacheValues(values) {
    this.database.serialize(() => {
      const query = `INSERT INTO ${this.CACHE_TABLE_NAME} (timestamp, data, point_id) VALUES (?, ?, ?)`
      const stmt = this.database.prepare(query)
      values.forEach((value) => {
        stmt.run(value.timestamp, encodeURI(value.data), value.pointId)
      })
      stmt.finalize()
    })
  }

  /**
   * Get values to resend.
   * @return {Promise} - The query status
   */
  getValuesToResend() {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, timestamp, data, point_id AS pointId 
                   FROM ${this.CACHE_TABLE_NAME}
                   ORDER BY timestamp
                   LIMIT ${this.config.resendCount}`
      this.database.all(query, (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }

  /**
   * Remove resent values from the cache.
   * @param {Object} values - The values to remove from the cache
   * @return {void}
   */
  removeResentValues(values) {
    const ids = values.map(value => value.id).join()
    const query = `DELETE FROM ${this.CACHE_TABLE_NAME}
                   WHERE id IN (${ids})`
    this.database.run(query, (error) => {
      if (error) {
        this.logger.error(error)
      }
    })
  }

  /**
   * Callback function used by the timer to send the values.
   * @return {void}
   */
  sendCallback() {
    this.getValuesToResend()
      .then((values) => {
        if (values.length > 0) {
          const decodedValues = values.map((value) => {
            value.data = decodeURI(value.data)
            return value
          })

          // Try to resend data
          this.application.resendValues(decodedValues)
            .then((success) => {
              let timeout

              if (success) {
                this.removeResentValues(values)
                timeout = 1000 * this.config.resendInterval
              } else {
                timeout = 1000 * this.config.retryInterval
              }

              // Reactivate the resend timer with the interval based on the success of the actual resend attempt
              this.timeout = setTimeout(this.sendCallback.bind(this), timeout)
            })
        } else {
          const timeout = 1000 * this.config.resendInterval
          this.timeout = setTimeout(this.sendCallback.bind(this), timeout)
        }
      })
      .catch((error) => {
        this.logger.error(error.stack)

        const timeout = 1000 * this.config.retryInterval
        this.timeout = setTimeout(this.sendCallback.bind(this), timeout)
      })
  }
}

module.exports = LocalCache
