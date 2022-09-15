const db = require('better-sqlite3')

const CACHE_TABLE_NAME = 'cache'

/**
 * Initiate SQLite database and create the cache table.
 * @param {string} databasePath - The database file path
 * @param {object} options - SQLite database options
 * @return {object} - The SQLite database
 */
const createValuesDatabase = (databasePath, options = {}) => {
  const database = db(databasePath)
  database.prepare(`CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (`
                       + 'id INTEGER PRIMARY KEY, '
                       + 'timestamp TEXT KEY, '
                       + 'data TEXT, '
                       + 'point_id TEXT, '
                       + 'south TEXT);').run()
  database.prepare('PRAGMA secure_delete = OFF;').run()
  database.prepare('PRAGMA cache_size = 100000;').run()
  database.prepare('PRAGMA locking_mode = exclusive;').run()
  if (options.wal) database.prepare('PRAGMA journal_mode = WAL;').run()
  if (options.optimize) database.prepare('PRAGMA optimize;').run()
  if (options.vacuum) database.prepare('PRAGMA vacuum;').run()

  return database
}

/**
 * Initiate SQLite database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {object} - The SQLite database
 */
const createFilesDatabase = (databasePath) => {
  const database = db(databasePath)

  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (`
                + 'id INTEGER PRIMARY KEY, '
                + 'timestamp INTEGER, '
                + 'path TEXT);'
  database.prepare(query).run()

  return database
}

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
 * Initiate SQLite database and create the cache table.
 * @param {string} databasePath - The database file path
 * @return {object} - The SQLite database
 */
const createValueErrorsDatabase = (databasePath) => {
  const database = db(databasePath)
  const query = `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE_NAME} (`
                   + 'id INTEGER PRIMARY KEY, '
                   + 'timestamp TEXT, '
                   + 'data TEXT, '
                   + 'point_id TEXT);'
  database.prepare(query).run()

  return database
}

/**
 * Save values in a SQLite database.
 * @param {object} database - The SQLite database to use
 * @param {String} southName - The name of the South connector to be sent with the value
 * @param {object} values - The values to save
 * @return {void}
 */
const saveValues = (database, southName, values) => {
  const queryStart = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id, south) VALUES `
  const prepValues = values.map((value) => `('${value.timestamp}','${encodeURI(JSON.stringify(value.data))}','${value.pointId}','${southName}')`)
  const query = `${queryStart}${prepValues.join(',')};`
  database.prepare(query).run()
}

/**
 * Save errored values in a SQLite database.
 * @param {object} database - The database to use
 * @param {object} values - The values to save
 * @return {void}
 */
const saveErroredValues = (database, values) => {
  const queryStart = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, data, point_id) VALUES `
  const prepValues = values.map((value) => `('${value.timestamp}','${encodeURI(JSON.stringify(value.data))}','${value.pointId}')`)
  const query = `${queryStart}${prepValues.join(',')};`
  database.prepare(query).run()
}

/**
 * Get values count.
 * @param {object} database - The SQLite database to use
 * @return {number} - The values count
 */
const getCount = (database) => {
  const query = `SELECT COUNT(*) AS count FROM ${CACHE_TABLE_NAME}`
  const result = database.prepare(query).get()
  return result.count
}

/**
 * Get values to send to a given North connector.
 * @param {object} database - The SQLite database to use
 * @param {number} count - The number of values to get
 * @return {array} - The values
 */
const getValuesToSend = (database, count) => {
  const query = 'SELECT id, timestamp, data, point_id AS pointId, south as dataSourceId '
                + `FROM ${CACHE_TABLE_NAME} `
                + 'ORDER BY timestamp '
                + `LIMIT ${count}`
  const values = []
  const stmt = database.prepare(query)
  // eslint-disable-next-line no-restricted-syntax
  for (const value of stmt.iterate()) {
    values.push({ ...value, data: JSON.parse(decodeURI(value.data)) })
  }
  return values
}

/**
 * Remove sent values from the cache for a given North connector.
 * @param {object} database - The database to use
 * @param {Object} values - The values to remove
 * @return {number} number of deleted values
 */
const removeSentValues = (database, values) => {
  const ids = values.map((value) => value.id).join()
  const query = `DELETE FROM ${CACHE_TABLE_NAME} WHERE id IN (${ids})`
  const result = database.prepare(query).run()
  return result.changes
}

/**
 * Save file for a given North connector.
 * @param {object} database - The database to use
 * @param {number} timestamp - The timestamp
 * @param {string} filePath - The file path
 * @return {void} - Promise resolved when the transaction is done successfully
 */
const saveFile = (database, timestamp, filePath) => {
  const query = `INSERT INTO ${CACHE_TABLE_NAME} (timestamp, path) VALUES (?, ?)`
  database.prepare(query).run(timestamp, filePath)
}

/**
 * Get file to send to a given North connector.
 * @param {object} database - The database to use
 * @return {{path: string, timestamp: number}|null} - The file path
 */
const getFileToSend = (database) => {
  const query = 'SELECT path, timestamp '
                 + `FROM ${CACHE_TABLE_NAME} `
                 + 'ORDER BY timestamp '
                 + 'LIMIT 1'
  const results = database.prepare(query).all()

  return results.length > 0 ? results[0] : null
}

/**
 * Delete sent file from the cache for a given North connector.
 * @param {object} database - The database to use
 * @param {string} filePath - The file path
 * @return {void}
 */
const deleteSentFile = (database, filePath) => {
  const query = `DELETE FROM ${CACHE_TABLE_NAME} WHERE path = ?`
  database.prepare(query).run(filePath)
}

/**
 * Get file count.
 * @param {object} database - The database to use
 * @param {string} filePath - The file path
 * @return {number} - The file count
 */
const getFileCount = (database, filePath) => {
  const query = `SELECT COUNT(*) AS count FROM ${CACHE_TABLE_NAME} WHERE path = ?`
  const result = database.prepare(query).get(filePath)

  return result.count
}

/**
 * Get file count for a North connector.
 * @param {object} database - The database to use
 * @return {number} - The file count
 */
const getFileCountForNorthConnector = (database) => {
  const query = `SELECT COUNT(*) AS count FROM ${CACHE_TABLE_NAME}`
  const result = database.prepare(query).get()

  return result.count
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
  getFileCountForNorthConnector,
  upsertConfig,
  getConfig,
  getLogs,
  getHistoryQuerySouthData,
}
