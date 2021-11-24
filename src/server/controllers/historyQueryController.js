/**
 * Get the active HistoryQuery configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getActiveConfiguration = (ctx) => {
  ctx.ok({ config: ctx.app.engine.configService.getActiveHistoryQueryConfiguration() })
}

/**
 * Update HistoryQuery config.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateConfig = (ctx) => {
  try {
    ctx.app.engine.configService.updateHistoryQueryConfig(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to update Config')
  }
}

/**
 * Activate the HistoryQuery configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const activateConfiguration = (ctx) => {
  try {
    ctx.app.engine.configService.activateHistoryQueryConfiguration()
    ctx.ok('Reloading...')
  } catch (error) {
    ctx.throw(500, 'Unable to activate configuration')
  }
}

/**
 * Get status for the given HistoryQuery.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const status = await ctx.app.engine.getStatusForHistoryQuery(ctx.params.id)
  ctx.ok(status)
}

module.exports = {
  getActiveConfiguration,
  updateConfig,
  activateConfiguration,
  getStatus,
}
