const Database = require('better-sqlite3')

const CACHE_TABLE_NAME = 'cache'

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {BetterSqlite3.Database} - The SQLite3 database
 */
const createValuesDatabase = (databasePath) => {
  const database = new Database(databasePath)

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp INTEGER,
                   data TEXT,
                   point_id TEXT
                 );`
  const stmt = database.prepare(query)
  stmt.run()

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {BetterSqlite3.Database} - The SQLite3 database
 */
const createFilesDatabase = (databasePath) => {
  const database = new Database(databasePath)

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp INTEGER,
                   application TEXT,
                   path TEXT
                 );`
  const stmt = database.prepare(query)
  stmt.run()

  return database
}

/**
 * Save value in database.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {object} value - The value to save
 * @return {void}
 */
const saveValue = (database, value) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id) 
                 VALUES (?, ?, ?)`
  const stmt = database.prepare(query)
  stmt.run(value.timestamp, encodeURI(value.data), value.pointId)
}

/**
 * Get values count.
 * @param {BetterSqlite3.Database} database - The database to use
 * @return {number} - The values count
 */
const getValuesCount = (database) => {
  const query = `SELECT COUNT(*) AS count
                 FROM ${CACHE_TABLE_NAME}`
  const stmt = database.prepare(query)
  const result = stmt.get()

  return result.count
}

/**
 * Get values to send to a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} count - The number of values to get
 * @return {array|null} - The values
 */
const getValuesToSend = (database, count) => {
  const query = `SELECT id, timestamp, data, point_id AS pointId 
                 FROM ${CACHE_TABLE_NAME}
                 ORDER BY timestamp
                 LIMIT ${count}`
  const stmt = database.prepare(query)
  const results = stmt.all()

  let values = null

  if (results.length > 0) {
    values = results.map((value) => {
      value.data = decodeURI(value.data)
      return value
    })
  }

  return values
}

/**
 * Remove sent values from the cache for a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {Object} values - The values to remove
 * @return {void}
 */
const removeSentValues = (database, values) => {
  const ids = values.map(value => value.id).join()
  const query = `DELETE FROM ${CACHE_TABLE_NAME}
                 WHERE id IN (${ids})`
  const stmt = database.prepare(query)
  stmt.run()
}

/**
 * Save file for a given application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {number} timestamp - The timestamp
 * @param {string} applicationId - The application ID
 * @param {string} filePath - The file path
 * @return {void}
 */
const saveFile = (database, timestamp, applicationId, filePath) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, application, path) 
                 VALUES (?, ?, ?)`
  const stmt = database.prepare(query)
  stmt.run(timestamp, applicationId, filePath)
}

/**
 * Get file to send to a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} applicationId - The application ID
 * @return {string|null} - The file path
 */
const getFileToSend = (database, applicationId) => {
  const query = `SELECT path 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                 ORDER BY timestamp
                 LIMIT 1`
  const stmt = database.prepare(query)
  const results = stmt.all(applicationId)

  return results.length > 0 ? results[0].path : null
}

/**
 * Delete sent file from the cache for a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} applicationId - The application ID
 * @param {string} filePath - The file path
 * @return {void}
 */
const deleteSentFile = (database, applicationId, filePath) => {
  const query = `DELETE FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                   AND path = ?`
  const stmt = database.prepare(query)
  stmt.run(applicationId, filePath)
}

/**
 * Get file count.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} filePath - The file path
 * @return {number} - The file count
 */
const getFileCount = (database, filePath) => {
  const query = `SELECT COUNT(*) AS count 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE path = ?`
  const stmt = database.prepare(query)
  const result = stmt.get(filePath)

  return result.count
}

module.exports = {
  createValuesDatabase,
  createFilesDatabase,
  saveValue,
  getValuesCount,
  getValuesToSend,
  removeSentValues,
  saveFile,
  getFileToSend,
  deleteSentFile,
  getFileCount,
}
