const db = require('better-sqlite3')
const HistoryQuery = require('./HistoryQuery.class')

class HistoryQueryRepository {
  static TABLE = 'history_queries'

  constructor(databasePath) {
    this.databasePath = databasePath
    this.database = db(this.databasePath)
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
    this.database.prepare(query).run()
  }

  /**
   * Create a new HistoryQuery.
   * @param {Object} historyQueryToCreate - The HistoryQuery info
   * @return {Object} - The HistoryQuery
   */
  create(historyQueryToCreate) {
    let order = 1
    const orderQuery = `SELECT MAX(orderColumn) AS maxOrder FROM ${HistoryQueryRepository.TABLE}`
    const orderResult = this.database.prepare(orderQuery).get()
    if (orderResult) {
      order = orderResult.maxOrder + 1
    }

    const query = `INSERT INTO ${HistoryQueryRepository.TABLE} 
                                (id,
                                orderColumn,
                                name,
                                status,
                                enabled,
                                southId,
                                northId,
                                startTime,
                                endTime,
                                filePattern,
                                compress,
                                settings)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    this.database.prepare(query).run(
      historyQueryToCreate.id,
      order ?? 1,
      historyQueryToCreate.name,
      historyQueryToCreate.status,
      +historyQueryToCreate.enabled,
      historyQueryToCreate.southId,
      historyQueryToCreate.northId,
      historyQueryToCreate.startTime,
      historyQueryToCreate.endTime,
      historyQueryToCreate.filePattern,
      +historyQueryToCreate.compress,
      JSON.stringify(historyQueryToCreate.settings),
    )

    return this.get(historyQueryToCreate.id)
  }

  /**
   * Get all HistoryQueries.
   * @return {Object[]} - The HistoryQueries
   */
  getAll() {
    const query = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}`
    const historyQueries = this.database.prepare(query).all()
    return historyQueries.map((historyQuery) => {
      historyQuery.settings = JSON.parse(historyQuery.settings)
      return historyQuery
    })
  }

  /**
   * Get a HistoryQuery.
   * @param {String} id - The HistoryQuery id
   * @return {Object} - The HistoryQuery
   */
  get(id) {
    const query = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE id = ?`
    const result = this.database.prepare(query).get(id)

    if (result) {
      result.settings = JSON.parse(result.settings)
    }

    return result
  }

  /**
   * Update a HistoryQuery.
   * @param {Object} historyQueryToUpdate - The HistoryQuery info
   * @return {Object} - The updated HistoryQuery
   */
  update(historyQueryToUpdate) {
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
    this.database.prepare(query).run(
      historyQueryToUpdate.orderColumn,
      historyQueryToUpdate.name,
      historyQueryToUpdate.status,
      +historyQueryToUpdate.enabled,
      historyQueryToUpdate.southId,
      historyQueryToUpdate.northId,
      historyQueryToUpdate.startTime,
      historyQueryToUpdate.endTime,
      historyQueryToUpdate.filePattern,
      +historyQueryToUpdate.compress,
      JSON.stringify(historyQueryToUpdate.settings),
      historyQueryToUpdate.id,
    )

    return this.get(historyQueryToUpdate.id)
  }

  /**
   * Reorder a HistoryQuery.
   * @param {String} id - The HistoryQuery id
   * @param {Number} orderColumn - The new order
   * @return {Object} - The re-ordered HistoryQuery
   */
  order(id, orderColumn) {
    const historyQuery = this.get(id)

    const query = `UPDATE ${HistoryQueryRepository.TABLE}
                   SET orderColumn = ?
                   WHERE id = ?`
    this.database.prepare(query).run(orderColumn, id)

    historyQuery.orderColumn = orderColumn
    return this.update(historyQuery)
  }

  /**
   * Delete a HistoryQuery.
   * @param {String} id - The HistoryQuery id
   * @return {void}
   */
  delete(id) {
    const query = `DELETE
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE id = ?`
    this.database.prepare(query).run(id)
  }

  /**
   * Get next HistoryQuery to run.
   * @return {Object|null} - The next HistoryQuery to run
   */
  getNextToRun() {
    const ongoingQuery = `SELECT *
                   FROM ${HistoryQueryRepository.TABLE}
                   WHERE enabled = 1
                     AND status IN ('${HistoryQuery.STATUS_RUNNING}')
                   ORDER BY orderColumn ASC
                   LIMIT 1`
    const ongoingResults = this.database.prepare(ongoingQuery).all()
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
    const pendingResults = this.database.prepare(pendingQuery).all()
    if (pendingResults.length > 0) {
      const pendingHistoryQuery = pendingResults[0]
      pendingHistoryQuery.settings = JSON.parse(pendingHistoryQuery.settings)
      return pendingHistoryQuery
    }

    return null
  }
}

module.exports = HistoryQueryRepository
