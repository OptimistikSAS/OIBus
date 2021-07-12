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
  const { engineConfig } = ctx.app.engine.configService.getConfig()
  const databasePath = engineConfig.logParameters.sqliteLog.fileName
  const now = Date.now()
  const dayAgo = new Date(now - 86400000)
  const fromDate = ctx.query.fromDate || new Date(dayAgo).toISOString()
  const toDate = ctx.query.toDate || new Date(now).toISOString()
  const verbosity = ctx.query.verbosity.replace(/\[|\]/g, '').split(',')

  const logs = await databaseService.getLogs(databasePath, fromDate, toDate, verbosity)
  ctx.ok(logs)
}

module.exports = { getLogs }
