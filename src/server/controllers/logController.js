const databaseService = require('../../services/database.service')

/**
 * Get logs.
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.query - The query parameters
 * @param {string} ctx.query.fromDate - From date in milliseconds
 * @param {string} ctx.query.toDate - To date in milliseconds
 * @param {string} ctx.query.verbosity - Verbosity
 * @return {void}
 */
const getLogs = async (ctx) => {
  const databasePath = ctx.app.engine.config.engine.logParameters.sqliteFilename
  const fromDate = ctx.query.fromDate || new Date().getTime() - 24 * 3600 * 1000
  const toDate = ctx.query.toDate || new Date().getTime()
  const verbosity = ctx.query.verbosity || '%'

  const logs = await databaseService.getLogs(databasePath, fromDate, toDate, verbosity)
  ctx.ok(logs)
}

module.exports = { getLogs }
