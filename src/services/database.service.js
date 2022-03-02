const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')

const CACHE_TABLE_NAME = 'cache'

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @param {any} options - options
 * @return {sqlite.Database} - The SQLite3 database
 */
const createValuesDatabase = async (databasePath, options) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  await database.run(`CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp TEXT KEY,
                   data TEXT,
                   point_id TEXT,
                   data_source TEXT
                 );`)
  await database.run('PRAGMA secure_delete = OFF;')
  await database.run('PRAGMA cache_size = 100000;')
  await database.run('PRAGMA locking_mode = exclusive;')
  if (options?.wal) await database.run('PRAGMA journal_mode = WAL;')
  if (options?.optimize) await database.run('PRAGMA optimize;')
  if (options?.vacuum) await database.run('PRAGMA vacuum;')

  return database
}

/**
 * Initiate SQLite3 database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {sqlite.Database} - The SQLite3 database
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
 * @return {sqlite.Database} - The SQLite3 database
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
 * @return {sqlite.Database} - The SQLite3 database
 */
const createValueErrorsDatabase = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (
                   id INTEGER PRIMARY KEY,
                   timestamp TEXT,
                   data TEXT,
                   point_id TEXT,
                   application TEXT
                 );`
  const stmt = await database.prepare(query)
  await stmt.run()

  return database
}

/**
 * Save values in database.
 * @param {sqlite.Database} database - The database to use
 * @param {String} dataSourceName - The name of the data source to be sent with the value
 * @param {object} values - The values to save
 * @return {void}
 */
const saveValues = async (database, dataSourceName, values) => {
  const queryStart = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id, data_source)
                      VALUES `
  const prepValues = values.map((value) => `('${value.timestamp}','${encodeURI(JSON.stringify(value.data))}','${value.pointId}','${dataSourceName}')`)
  const query = `${queryStart}${prepValues.join(',')};`
  await database.run(query)
}

/**
 * Save errored values in database.
 * @param {sqlite.Database} database - The database to use
 * @param {String} id - The application id
 * @param {object} values - The values to save
 * @return {void}
 */
const saveErroredValues = async (database, id, values) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id, application)
                 VALUES (?, ?, ?, ?)`
  await database.run('BEGIN;')
  const stmt = await database.prepare(query)
  const actions = values.map((value) => stmt.run(value.timestamp, encodeURI(JSON.stringify(value.data)), value.pointId, id))
  await Promise.all(actions)
  await database.run('COMMIT;')
}

/**
 * Get values count.
 * @param {sqlite.Database} database - The database to use
 * @return {Promise<number>} - The values count
 */
const getCount = async (database) => {
  const query = `SELECT COUNT(*) AS count
                 FROM ${CACHE_TABLE_NAME}`
  const stmt = await database.prepare(query)
  const result = await stmt.get()
  return result.count
}

/**
 * Get values to send to a given North application.
 * @param {sqlite.Database} database - The database to use
 * @param {string} count - The number of values to get
 * @return {array|null} - The values
 */
const getValuesToSend = async (database, count) => {
  const query = `SELECT id, timestamp, data, point_id AS pointId, data_source as dataSourceId
                 FROM ${CACHE_TABLE_NAME}
                 ORDER BY timestamp
                 LIMIT ${count}`
  const values = []
  await database.each(query, (err, value) => {
    if (err) throw err
    values.push({ ...value, data: JSON.parse(decodeURI(value.data)) })
  })
  return values
}

/**
 * Remove sent values from the cache for a given North application.
 * @param {sqlite.Database} database - The database to use
 * @param {Object} values - The values to remove
 * @return {Promise<number>} number of deleted values
 */
const removeSentValues = async (database, values) => {
  const ids = values.map((value) => value.id).join()
  const query = `DELETE FROM ${CACHE_TABLE_NAME}
                   WHERE id IN (${ids})`
  const result = await database.run(query)
  return result.changes
}

/**
 * Save file for a given application.
 * @param {sqlite.Database} database - The database to use
 * @param {number} timestamp - The timestamp
 * @param {string} id - The application id
 * @param {string} filePath - The file path
 * @return {Promise<void>} - Promise resolved when the transition is done successfully
 */
const saveFile = async (database, timestamp, id, filePath) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, application, path) 
                 VALUES (?, ?, ?)`
  const stmt = await database.prepare(query)
  await stmt.run(timestamp, id, filePath)
}

/**
 * Get file to send to a given North application.
 * @param {sqlite.Database} database - The database to use
 * @param {string} id - The application id
 * @return {Promise<{path: string, timestamp: number}>} - The file path
 */
const getFileToSend = async (database, id) => {
  const query = `SELECT path, timestamp 
                 FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                 ORDER BY timestamp
                 LIMIT 1`
  const stmt = await database.prepare(query)
  const results = await stmt.all(id)

  return results.length > 0 ? results[0] : null
}

/**
 * Delete sent file from the cache for a given North application.
 * @param {sqlite.Database} database - The database to use
 * @param {string} id - The application id
 * @param {string} filePath - The file path
 * @return {void}
 */
const deleteSentFile = async (database, id, filePath) => {
  const query = `DELETE FROM ${CACHE_TABLE_NAME}
                 WHERE application = ?
                   AND path = ?`
  const stmt = await database.prepare(query)
  await stmt.run(id, filePath)
}

/**
 * Get file count.
 * @param {sqlite.Database} database - The database to use
 * @param {string} filePath - The file path
 * @return {Promise<number>} - The file count
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
 * @param {sqlite.Database} database - The database to use
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
 * Upsert config entry.
 * @param {sqlite.Database} database - The database to use
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
 * @param {sqlite.Database} database - The database to use
 * @param {string} name - The config name
 * @return {Promise<string>} - The config value
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

/**
 * Get logs count.
 * @param {string} databasePath - The database path
 * @return {Promise<{error: number, warn: number}>} - The logs count
 */
const getLogsCount = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `SELECT level, COUNT(level) AS count
                 FROM logs
                 GROUP BY level`
  const stmt = await database.prepare(query)
  const results = await stmt.all()
  const errorLogCount = results.find((logCount) => logCount.level === 'error')
  const warningLogCount = results.find((logCount) => logCount.level === 'warn')
  return {
    error: errorLogCount ? errorLogCount.count : 0,
    warn: warningLogCount ? warningLogCount.count : 0,
  }
}

/**
 * Get number of errored values.
 * @param {string} databasePath - The database path
 * @returns {Promise<number>} - The count
 */
const getErroredValuesCount = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `SELECT COUNT(*) AS count
                 FROM ${CACHE_TABLE_NAME}`
  const stmt = await database.prepare(query)
  const results = await stmt.all()
  return results.length > 0 ? results[0].count : 0
}

/**
 * Get number of errored files.
 * @param {string} databasePath - The database path
 * @returns {Promise<number>} - The count
 */
const getErroredFilesCount = async (databasePath) => {
  const database = await sqlite.open({ filename: databasePath, driver: sqlite3.cached.Database })
  const query = `SELECT COUNT(*) AS count
                 FROM ${CACHE_TABLE_NAME}`
  const stmt = await database.prepare(query)
  const results = await stmt.all()
  return results.length > 0 ? results[0].count : 0
}

/**
 * Get South related data for HistoryQuery.
 * @param {string} databasePath - The database path
 * @returns {Promise<object>} - The data
 */
const getHistoryQuerySouthData = async (databasePath) => {
  const database = await sqlite.open({
    filename: databasePath,
    driver: sqlite3.cached.Database,
  })
  const query = `SELECT * FROM ${CACHE_TABLE_NAME}`
  const stmt = await database.prepare(query)
  return stmt.all()
}

module.exports = {
  createValuesDatabase,
  createFilesDatabase,
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
  upsertConfig,
  getConfig,
  getLogs,
  getLogsCount,
  getErroredValuesCount,
  getErroredFilesCount,
  getHistoryQuerySouthData,
}
