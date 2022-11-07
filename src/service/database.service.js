const db = require('better-sqlite3')

const CACHE_TABLE_NAME = 'cache'
const PAGE_SIZE = 50

/**
 * Initiate SQLite database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {object} - The SQLite database
 */
const createConfigDatabase = (databasePath) => {
  const database = db(databasePath)

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (`
                   + 'id INTEGER PRIMARY KEY, '
                   + 'name TEXT UNIQUE, '
                   + 'value TEXT);'
  database.prepare(query).run()

  return database
}
/**
 * Upsert config entry.
 * @param {object} database - The database to use
 * @param {string} name - The config entry
 * @param {string} value - The config value
 * @return {void}
 */
const upsertConfig = (database, name, value) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (name, value) `
                 + 'VALUES (?, ?) '
                 + 'ON CONFLICT(name) DO UPDATE SET value = ?'
  database.prepare(query).run(name, value, value)
}

/**
 * Get configuration.
 * @param {object} database - The database to use
 * @param {string} name - The config name
 * @return {string|null} - The config value
 */
const getConfig = (database, name) => {
  const query = 'SELECT value '
                 + `FROM ${CACHE_TABLE_NAME} `
                 + 'WHERE name = ?'
  const result = database.prepare(query).get(name)

  return result?.value
}

/**
 * Get logs.
 * @param {string} databasePath - The database path
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @param {string[]} verbosity - Verbosity levels
 * @return {object[]} - The logs
 */
const getLogs = (databasePath, fromDate, toDate, verbosity) => {
  const database = db(databasePath)
  const query = 'SELECT * FROM logs '
                 + 'WHERE timestamp BETWEEN ? AND ? '
                 + `AND level IN (${verbosity.map((_) => '?')})`
  return database.prepare(query).all([fromDate, toDate, ...verbosity])
}

/**
 * Get paginated logs
 * @param {string} databasePath - The database path
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @param {string} scope - The scope of the log
 * @param {string} textMessage - Text the message must contain
 * @param {string[]} verbosity - Verbosity levels
 * @param {'ASC' | 'DESC'} sorting - The sorting to use
 * @param {number} pageNumber - The page number to request
 * @return {
 * {
 *  content: {timestamp: String, level: String, scope: String, source: String}[],
 *  pageSize: Number,
 *  pageNumber: Number,
 *  totalNumberOfElements: Number,
 *  totalNumberOfPages: Number
 * }} - The paginated logs
 */
const getPaginatedLogs = (
  databasePath,
  fromDate,
  toDate,
  scope,
  textMessage,
  verbosity,
  sorting,
  pageNumber = 0,
) => {
  const database = db(databasePath)
  let whereClause = `WHERE timestamp BETWEEN '${fromDate}' AND '${toDate}' `
  + `AND level IN (${verbosity.map((verb) => `'${verb}'`)})`
  if (scope) {
    whereClause += ` AND scope = '${scope}'`
  }
  if (textMessage) {
    whereClause += ` AND message like '%${textMessage}%'`
  }

  const query = `SELECT timestamp, level, scope, source, message FROM logs ${whereClause}`
      + ` ORDER BY timestamp ${sorting} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * pageNumber}`
  const results = database.prepare(query).all()
  const totalNumberOfElements = database.prepare(`SELECT COUNT(*) as count FROM logs ${whereClause}`).get().count
  const totalNumberOfPages = Math.ceil(totalNumberOfElements / PAGE_SIZE)

  return {
    content: results,
    pageSize: results.length,
    pageNumber,
    totalNumberOfElements,
    totalNumberOfPages,
  }
}

/**
 * Get South connector related data for HistoryQuery.
 * @param {string} databasePath - The database path
 * @returns {object} - The data
 */
const getHistoryQuerySouthData = (databasePath) => {
  const database = db(databasePath)
  const query = `SELECT * FROM ${CACHE_TABLE_NAME}`
  return database.prepare(query).all()
}

module.exports = {
  createConfigDatabase,
  upsertConfig,
  getConfig,
  getLogs,
  getPaginatedLogs,
  getHistoryQuerySouthData,
}
