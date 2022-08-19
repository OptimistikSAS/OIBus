const db = require('better-sqlite3')
const HistoryQuery = require('./HistoryQuery.class')

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
    this.database = await db(this.databasePath)
    const query = `CREATE TABLE IF NOT EXISTS ${HistoryQueryRepository.TABLE} (
                   id TEXT PRIMARY KEY,
                   orderColumn INTEGER,
                   name TEXT,
                   status TEXT,
                   enabled INTEGER,
                   southId TEXT,
                   northId TEXT,
                   startTime TEXT,
                   endTime TEXT,
                   filePattern TEXT,
                   compress INTEGER,
                   settings TEXT
                 );`
    await this.database.prepare(query).run()
  }

  /**
   * Create a new HistoryQuery.
   * @param {object} historyQuery - The HistoryQuery info
   * @return {Promise<object>} - The HistoryQuery
   */
  async create(historyQuery) {
    let order = 1
    const orderQuery = `SELECT MAX(orderColumn) AS maxOrder FROM ${HistoryQueryRepository.TABLE}`
    const orderResult = await this.database.prepare(orderQuery).get()
    if (orderResult) {
      order = orderResult.maxOrder + 1
    }

    const query = `INSERT INTO ${HistoryQueryRepository.TABLE} (id, orderColumn, name, status, enabled, southId, northId, startTime, endTime,
                                                                filePattern, compress, settings)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const stmt = await this.database.prepare(query)
    await stmt.run(
      historyQuery.id,
      order ?? 1,
      historyQuery.name,
      historyQuery.status,
      historyQuery.enabled,
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
    const query = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE id = ?`
    const stmt = await this.database.prepare(query)
    const result = await stmt.get(id)

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
                   SET orderColumn = ?
                   WHERE id = ?`
    const stmt = await this.database.prepare(query)
    await stmt.run(orderColumn, id)

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

  /**
   * Get next HistoryQuery to run.
   * @return {Promise<object|null>} - The next HistoryQuery to run
   */
  async getNextToRun() {
    const ongoingQuery = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE enabled = 1
                     AND status IN ('${HistoryQuery.STATUS_EXPORTING}', '${HistoryQuery.STATUS_IMPORTING}')
                   ORDER BY orderColumn ASC
                   LIMIT 1`
    const ongoingStmt = await this.database.prepare(ongoingQuery)
    const ongoingResults = await ongoingStmt.all()
    if (ongoingResults.length > 0) {
      const ongoingHistoryQuery = ongoingResults[0]
      ongoingHistoryQuery.settings = JSON.parse(ongoingHistoryQuery.settings)
      return ongoingHistoryQuery
    }

    const pendingQuery = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE enabled = 1
                     AND status = '${HistoryQuery.STATUS_PENDING}'
                   ORDER BY orderColumn ASC
                   LIMIT 1`
    const pendingStmt = await this.database.prepare(pendingQuery)
    const pendingResults = await pendingStmt.all()
    if (pendingResults.length > 0) {
      const pendingHistoryQuery = pendingResults[0]
      pendingHistoryQuery.settings = JSON.parse(pendingHistoryQuery.settings)
      return pendingHistoryQuery
    }

    return null
  }
}

module.exports = HistoryQueryRepository
