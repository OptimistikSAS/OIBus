const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')

const Logger = require('../engine/Logger.class')

const logger = new Logger('database')

const CACHE_TABLE_NAME = 'cache'

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {Sqlite.Database} - The SQLite3 database
 */
const createValuesDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp TEXT,
                   data TEXT,
                   point_id TEXT,
                   data_source_id TEXT
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {BetterSqlite3.Database} - The SQLite3 database
 */
const createFilesDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp INTEGER,
                   application TEXT,
                   path TEXT
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {BetterSqlite3.Database} - The SQLite3 database
 */
const createFolderScannerDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   filename TEXT UNIQUE,
                   modified INTEGER
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {BetterSqlite3.Database} - The SQLite3 database
 */
const createConfigDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   name TEXT UNIQUE,
                   value TEXT
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {Sqlite.Database} - The SQLite3 database
 */
const createValueErrorsDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp TEXT,
                   data TEXT,
                   point_id TEXT,
                   application_id TEXT
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Save values in database.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {String} dataSourceId - The data source ID
 * @param {object} values - The values to save
 * @return {void}
 */
const saveValues = async (database, dataSourceId, values) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id, data_source_id) 
                 VALUES (?, ?, ?, ?)`
  try {
    await database.run('BEGIN;')
    const stmt = await database.prepare(query)
    const actions = values.map((value) => stmt.run(value.timestamp, encodeURI(JSON.stringify(value.data)), value.pointId, dataSourceId))
    await Promise.all(actions)
    await database.run('COMMIT;')
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Save errored values in database.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {String} applicationId - The application ID
 * @param {object} values - The values to save
 * @return {void}
 */
const saveErroredValues = async (database, applicationId, values) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id, applicationId) 
                 VALUES (?, ?, ?, ?)`
  try {
    await database.run('BEGIN;')
    const stmt = await database.prepare(query)
    const actions = values.map((value) => stmt.run(value.timestamp, encodeURI(JSON.stringify(value.data)), value.pointId, applicationId))
    await Promise.all(actions)
    await database.run('COMMIT;')
  } catch (error) {
    logger.error(error)
    throw error
  }
}

/**
 * Get values count.
 * @param {BetterSqlite3.Database} database - The database to use
 * @return {number} - The values count
 */
const getCount = async (database) => {
  const query = `SELECT COUNT(*) AS count
                 FROM ${CACHE_TABLE_NAME}`
  let result = {}
  try {
    const stmt = await database.prepare(query)
    result = await stmt.get()
  } catch (error) {
    logger.error(error)
    throw error
  }
  return result.count
}

/**
 * Get values to send to a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} count - The number of values to get
 * @return {array|null} - The values
 */
const getValuesToSend = async (database, count) => {
  const query = `SELECT id, timestamp, data, point_id AS pointId, data_source_id as dataSourceId
                 FROM ${CACHE_TABLE_NAME}
                 ORDER BY timestamp
                 LIMIT ${count}`
  let results
  try {
    const stmt = await database.prepare(query)
    results = await stmt.all()
  } catch (error) {
    logger.error(error)
    throw error
  }

  let values = null

  if (results.length > 0) {
    values = results.map((value) => {
      try {
        // data is a JSON object containing value and quality
        value.data = JSON.parse(decodeURI(value.data))
      } catch (error) {
        // log error but try to continue with value unchanged
        logger.error(new Error(` ${error.message} detected for value.data ${JSON.stringify(value)}`))
      }
      return value
    })
  }

  return values
}

/**
 * Remove sent values from the cache for a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {Object} values - The values to remove
 * @return {number} number of deleted values
 */
const removeSentValues = async (database, values) => {
  let result
  try {
    const ids = values.map((value) => value.id).join()
    const query = `DELETE FROM ${CACHE_TABLE_NAME}
                   WHERE id IN (${ids})`
    const stmt = await database.prepare(query)
    result = await stmt.run()
  } catch (error) {
    logger.error(error)
    throw error
  }
  return result.changes
}

/**
 * Save file for a given application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {number} timestamp - The timestamp
 * @param {string} applicationId - The application ID
 * @param {string} filePath - The file path
 * @return {void}
 */
const saveFile = async (database, timestamp, applicationId, filePath) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, application, path) 
                 VALUES (?, ?, ?)`
  const stmt = await database.prepare(query)
  await stmt.run(timestamp, applicationId, filePath)
}

/**
 * Get file to send to a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} applicationId - The application ID
 * @return {string|null} - The file path
 */
const getFileToSend = async (database, applicationId) => {
  const query = `SELECT path, timestamp 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                 ORDER BY timestamp
                 LIMIT 1`
  const stmt = await database.prepare(query)
  const results = await stmt.all(applicationId)

  return results.length > 0 ? results[0] : null
}

/**
 * Delete sent file from the cache for a given North application.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} applicationId - The application ID
 * @param {string} filePath - The file path
 * @return {void}
 */
const deleteSentFile = async (database, applicationId, filePath) => {
  const query = `DELETE FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                   AND path = ?`
  const stmt = await database.prepare(query)
  await stmt.run(applicationId, filePath)
}

/**
 * Get file count.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} filePath - The file path
 * @return {number} - The file count
 */
const getFileCount = async (database, filePath) => {
  const query = `SELECT COUNT(*) AS count 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE path = ?`
  const stmt = await database.prepare(query)
  const result = await stmt.get(filePath)

  return result.count
}

/**
 * Get file count for API.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} api - The api to get file count
 * @return {number} - The file count
 */
const getFileCountForApi = async (database, api) => {
  const query = `SELECT COUNT(*) AS count 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?`
  const stmt = await database.prepare(query)
  const result = await stmt.get(api)

  return result.count
}

/**
 * Upsert handled raw file.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} filename - The filename
 * @param {number} modified - The modify time
 * @return {void}
 */
const upsertFolderScanner = async (database, filename, modified) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (filename, modified) 
                 VALUES (?, ?)
                 ON CONFLICT(filename) DO UPDATE SET modified = ?`
  const stmt = await database.prepare(query)
  await stmt.run(filename, modified, modified)
}

/**
 * Get modify time for handled raw file.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} filename - The filename
 * @return {string|null} - The modify time
 */
const getFolderScannerModifyTime = async (database, filename) => {
  const query = `SELECT modified 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE filename = ?`
  const stmt = await database.prepare(query)
  const results = await stmt.all(filename)

  return results.length > 0 ? results[0].modified : null
}

/**
 * Upsert config entry.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} name - The config entry
 * @param {string} value - The config value
 * @return {void}
 */
const upsertConfig = async (database, name, value) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (name, value) 
                 VALUES (?, ?)
                 ON CONFLICT(name) DO UPDATE SET value = ?`
  const stmt = await database.prepare(query)
  await stmt.run(name, value, value)
}

/**
 * Get configuration.
 * @param {BetterSqlite3.Database} database - The database to use
 * @param {string} name - The config name
 * @return {string} - The config value
 */
const getConfig = async (database, name) => {
  const query = `SELECT value
                 FROM ${CACHE_TABLE_NAME}
                 WHERE name = ?`
  const stmt = await database.prepare(query)
  const result = await stmt.get(name)

  if (result) {
    return result.value
  }

  return null
}

/**
 * Get logs.
 * @param {string} databasePath - The database path
 * @param {string} fromDate - From date
 * @param {string} toDate - To date
 * @param {string[]} verbosity - Verbosity levels
 * @return {object[]} - The logs
 */
const getLogs = async (databasePath, fromDate, toDate, verbosity) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `SELECT *
                 FROM logs
                 WHERE timestamp BETWEEN ? AND ?
                 AND level IN (${verbosity.map((_) => '?')})`
  const stmt = await database.prepare(query)
  return stmt.all([fromDate, toDate, ...verbosity])
}

module.exports = {
  createValuesDatabase,
  createFilesDatabase,
  createFolderScannerDatabase,
  createConfigDatabase,
  createValueErrorsDatabase,
  saveValues,
  saveErroredValues,
  getCount,
  getValuesToSend,
  removeSentValues,
  saveFile,
  getFileToSend,
  deleteSentFile,
  getFileCount,
  getFileCountForApi,
  upsertFolderScanner,
  getFolderScannerModifyTime,
  upsertConfig,
  getConfig,
  getLogs,
}
