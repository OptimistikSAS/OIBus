const build = require('pino-abstract-transport')
const db = require('better-sqlite3')
const fs = require('fs/promises')

const LOGS_TABLE_NAME = 'logs'
const NUMBER_OF_RECORDS_TO_DELETE = 1
const DEFAULT_MAX_FILE_SIZE = 2000000
const LEVEL_FORMAT = { 10: 'silly', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' }

/**
 * Class to support logging to sqlite as a custom Pino Transport module
 *
 * @class SqliteTransport
 */
class SqliteTransport {
  constructor(options) {
    this.database = null
    this.fileName = options.fileName || ':memory:'
    this.tableName = options.tableName || LOGS_TABLE_NAME
    this.maxFileSize = options.maxSize || DEFAULT_MAX_FILE_SIZE
  }

  /**
   * Core logging method.
   * @param {Object} payload - object with logging info
   * @returns {undefined}
   */
  log = async (payload) => {
    await this.addLog(payload.time, payload.level, payload.scope, payload.source, payload.msg)
    const logFile = await fs.stat(this.fileName)
    if (logFile.size > this.maxFileSize) {
      await this.deleteOldLogs()
    }
  }

  /**
   * Add logs
   * @param {string} timestamp - The timestamp
   * @param {string} level - The level
   * @param {string} scope - The scope (south/north connector, engine...)
   * @param {string} source - The source file
   * @param {string} message - The message
   * @return {void}
   */
  addLog = async (timestamp, level, scope, source, message) => {
    const query = `INSERT INTO ${this.tableName} (timestamp, level, scope, source, message) VALUES (?, ?, ?, ?, ?);`
    await this.database.prepare(query).run(timestamp, LEVEL_FORMAT[level], scope, source, message)
  }

  /**
   * Delete old logs.
   * @return {void}
   */
  deleteOldLogs = async () => {
    const query = `DELETE
                   FROM ${this.tableName}
                   WHERE id IN (
                       SELECT id
                       FROM ${this.tableName}
                       ORDER BY id ASC
                       LIMIT ?);`
    await this.database.prepare(query).run(NUMBER_OF_RECORDS_TO_DELETE)
  }

  /**
   * Initiate database and create the logs table.
   * @return {void}
   */
  createLogsDatabase = async () => {
    this.database = await db(this.fileName)
    const query = `CREATE TABLE IF NOT EXISTS ${this.tableName}
                   (id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    level TEXT,
                    scope TEXT,
                    source TEXT,
                    message TEXT);`
    await this.database.prepare(query).run()
  }

  /**
   * Make sure the requests are done before closing the database
   * @returns {void}
   */
  end = async () => {
    if (this.database) {
      await this.database.close()
    }
  }
}

const createTransport = async (opts) => {
  const sqliteTransport = new SqliteTransport(opts)
  await sqliteTransport.createLogsDatabase()
  return build(async (source) => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const log of source) {
      await sqliteTransport.log(log)
    }
  }, {
    close: async () => {
      await sqliteTransport.end()
    },
  })
}

module.exports = createTransport
