const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')

class HistoryQueryRepository {
  static TABLE = 'history_queries'

  constructor(databasePath) {
    this.databasePath = databasePath
    this.database = null
  }

  /**
   * Initialize the HistoryQuery database
   * @return {Promise<void>} - The result promise
   */
  async initialize() {
    this.database = await sqlite.open({ filename: this.databasePath, driver: sqlite3.cached.Database })
    const query = `CREATE TABLE IF NOT EXISTS ${HistoryQueryRepository.TABLE} (
                   id TEXT PRIMARY KEY,
                   orderColumn INTEGER,
                   name TEXT,
                   status TEXT,
                   enabled INTEGER,
                   paused INTEGER,
                   southId TEXT,
                   northId TEXT,
                   startTime TEXT,
                   endTime TEXT,
                   filePattern TEXT,
                   compress INTEGER,
                   settings TEXT
                 );`
    const stmt = await this.database.prepare(query)
    await stmt.run()
  }

  /**
   * Create a new HistoryQuery.
   * @param {object} historyQuery - The HistoryQuery info
   * @return {Promise<object>} - The HistoryQuery
   */
  async create(historyQuery) {
    let order = 1
    const orderQuery = `SELECT MAX(orderColumn) AS maxOrder FROM ${HistoryQueryRepository.TABLE}`
    const orderStmt = await this.database.prepare(orderQuery)
    const orderResult = await orderStmt.get()
    if (orderResult) {
      order = orderResult.maxOrder + 1
    }

    const query = `INSERT INTO ${HistoryQueryRepository.TABLE} (id, orderColumn, name, status, enabled, paused, southId, northId, startTime, endTime,
                                                                filePattern, compress, settings)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const stmt = await this.database.prepare(query)
    await stmt.run(
      historyQuery.id,
      order ?? 1,
      historyQuery.name,
      historyQuery.status,
      historyQuery.enabled,
      historyQuery.paused,
      historyQuery.southId,
      historyQuery.northId,
      historyQuery.startTime,
      historyQuery.endTime,
      historyQuery.filePattern,
      historyQuery.compress,
      JSON.stringify(historyQuery.settings),
    )

    return this.get(historyQuery.id)
  }

  /**
   * Get all HistoryQueries.
   * @return {Promise<object[]>} - The HistoryQueries
   */
  async getAll() {
    const query = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}`
    const stmt = await this.database.prepare(query)
    const historyQueries = await stmt.all()
    return historyQueries.map((historyQuery) => {
      historyQuery.settings = JSON.parse(historyQuery.settings)
      return historyQuery
    })
  }

  /**
   * Get a HistoryQuery.
   * @param {string} id - The HistoryQuery id
   * @return {Promise<object>} - The HistoryQuery
   */
  async get(id) {
    let result = null
    const query = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE id = ?`
    const stmt = await this.database.prepare(query)
    result = await stmt.get(id)

    if (result) {
      result.settings = JSON.parse(result.settings)
    }

    return result
  }

  /**
   * Update a HistoryQuery.
   * @param {object} historyQuery - The HistoryQuery info
   * @return {Promise<object>} - The updated HistoryQuery
   */
  async update(historyQuery) {
    const query = `UPDATE ${HistoryQueryRepository.TABLE}
                   SET orderColumn = ?,
                       name = ?,
                       status = ?,
                       enabled = ?,
                       paused = ?,
                       southId = ?,
                       northId = ?,
                       startTime = ?,
                       endTime = ?,
                       filePattern = ?,
                       compress = ?,
                       settings = ?
                   WHERE id = ?`
    const stmt = await this.database.prepare(query)
    await stmt.run(
      historyQuery.orderColumn,
      historyQuery.name,
      historyQuery.status,
      historyQuery.enabled,
      historyQuery.paused,
      historyQuery.southId,
      historyQuery.northId,
      historyQuery.startTime,
      historyQuery.endTime,
      historyQuery.filePattern,
      historyQuery.compress,
      JSON.stringify(historyQuery.settings),
      historyQuery.id,
    )

    return this.get(historyQuery.id)
  }

  /**
   * Reorder a HistoryQuery.
   * @param {string} id - The HistoryQuery id
   * @param {number} orderColumn - The new order
   * @return {Promise<object>} - The re-ordered HistoryQuery
   */
  async order(id, orderColumn) {
    const historyQuery = await this.get(id)

    const query = `UPDATE ${HistoryQueryRepository.TABLE}
                   SET orderColumn = ?`
    const stmt = await this.database.prepare(query)
    await stmt.run(historyQuery.orderColumn)

    historyQuery.orderColumn = orderColumn
    return this.update(historyQuery)
  }

  /**
   * Delete a HistoryQuery.
   * @param {string} id - The HistoryQuery id
   * @return {Promise<void>} - The result promise
   */
  async delete(id) {
    const query = `DELETE
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE id = ?`
    const stmt = await this.database.prepare(query)
    await stmt.run(id)
  }
}

module.exports = HistoryQueryRepository
