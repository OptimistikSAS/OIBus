/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const status = { version: ctx.app.engine.getVersion() }
  ctx.ok(status)
}

module.exports = { getStatus }
