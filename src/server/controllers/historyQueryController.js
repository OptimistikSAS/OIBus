/**
 * Create a new HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const createHistoryQuery = async (ctx) => {
  const historyQuery = await ctx.app.historyQueryEngine.historyQueryRepository.create(ctx.request.body)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok(historyQuery)
}

/**
 * Get HistoryQuery entries.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getHistoryQueries = async (ctx) => {
  const historyQueries = await ctx.app.historyQueryEngine.historyQueryRepository.getAll()
  ctx.ok(historyQueries)
}

/**
 * Get HistoryQuery by id.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getHistoryQueryById = async (ctx) => {
  const historyQueries = await ctx.app.historyQueryEngine.historyQueryRepository.get(ctx.params.id)
  ctx.ok(historyQueries)
}

/**
 * Update a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateHistoryQuery = async (ctx) => {
  const updatedHistoryQuery = await ctx.app.historyQueryEngine.historyQueryRepository.update(ctx.request.body)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok(updatedHistoryQuery)
}

/**
 * Enable/Disable a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const enableHistoryQuery = async (ctx) => {
  const historyQuery = await ctx.app.historyQueryEngine.historyQueryRepository.get(ctx.params.id)
  historyQuery.enabled = ctx.request.body.enabled
  const updatedHistoryQuery = await ctx.app.historyQueryEngine.historyQueryRepository.update(historyQuery)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok(updatedHistoryQuery)
}

/**
 * Pause/Resume a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const pauseHistoryQuery = async (ctx) => {
  const historyQuery = await ctx.app.historyQueryEngine.historyQueryRepository.get(ctx.params.id)
  historyQuery.paused = ctx.request.body.paused
  const updatedHistoryQuery = await ctx.app.historyQueryEngine.historyQueryRepository.update(historyQuery)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok(updatedHistoryQuery)
}

/**
 * Re-order a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const orderHistoryQuery = async (ctx) => {
  const updatedHistoryQuery = await ctx.app.historyQueryEngine.historyQueryRepository.order(ctx.params.id, ctx.request.body.orderColumn)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok(updatedHistoryQuery)
}

/**
 * Delete a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const deleteHistoryQuery = async (ctx) => {
  await ctx.app.historyQueryEngine.historyQueryRepository.delete(ctx.params.id)
  process.send({ type: 'reload-historyquery-engine' })
  ctx.ok()
}

/**
 * Get status for the given HistoryQuery.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const status = await ctx.app.historyQueryEngine.getStatusForHistoryQuery(ctx.params.id)
  ctx.ok(status)
}

module.exports = {
  createHistoryQuery,
  getHistoryQueries,
  getHistoryQueryById,
  updateHistoryQuery,
  enableHistoryQuery,
  pauseHistoryQuery,
  orderHistoryQuery,
  deleteHistoryQuery,
  getStatus,
}
