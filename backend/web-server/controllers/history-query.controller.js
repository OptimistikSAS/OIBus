import { nanoid } from 'nanoid'
/**
 * Create a new HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const createHistoryQuery = (ctx) => {
  const id = nanoid()
  const historyQuery = ctx.app.historyQueryEngine.historyQueryRepository.create({ ...ctx.request.body, id })
  ctx.ok(historyQuery)
}

/**
 * Get HistoryQuery entries.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getHistoryQueries = (ctx) => {
  const historyQueries = ctx.app.historyQueryEngine.historyQueryRepository.getAll()
  ctx.ok(historyQueries)
}

/**
 * Get HistoryQuery by id.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getHistoryQueryById = (ctx) => {
  const historyQueries = ctx.app.historyQueryEngine.historyQueryRepository.get(ctx.params.id)
  ctx.ok(historyQueries)
}

/**
 * Update a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateHistoryQuery = async (ctx) => {
  const updatedHistoryQuery = ctx.app.historyQueryEngine.historyQueryRepository.update(ctx.request.body)
  if (ctx.request.body.id === ctx.app.historyQueryEngine.historyQuery?.historyConfiguration.id) {
    await ctx.app.historyQueryEngine.historyQuery.stop()
  }
  ctx.ok(updatedHistoryQuery)
}

/**
 * Enable/Disable a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const enableHistoryQuery = async (ctx) => {
  const historyQuery = ctx.app.historyQueryEngine.historyQueryRepository.get(ctx.params.id)
  historyQuery.enabled = ctx.request.body.enabled
  const updatedHistoryQuery = ctx.app.historyQueryEngine.historyQueryRepository.update(historyQuery)
  if (ctx.params.id === ctx.app.historyQueryEngine.historyQuery?.historyConfiguration.id) {
    await ctx.app.historyQueryEngine.historyQuery.stop()
  }
  ctx.ok(updatedHistoryQuery)
}

/**
 * Re-order a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const orderHistoryQuery = (ctx) => {
  const updatedHistoryQuery = ctx.app.historyQueryEngine.historyQueryRepository.order(ctx.params.id, ctx.request.body.orderColumn)
  ctx.ok(updatedHistoryQuery)
}

/**
 * Delete a HistoryQuery entry.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const deleteHistoryQuery = async (ctx) => {
  const { position } = ctx.query
  ctx.app.historyQueryEngine.historyQueryRepository.delete(ctx.params.id)
  if (ctx.params.id === ctx.app.historyQueryEngine.historyQuery?.historyConfiguration.id) {
    await ctx.app.historyQueryEngine.historyQuery.stop()
  }

  const queries = ctx.app.historyQueryEngine.historyQueryRepository.getAll()
  queries.filter((query) => query.orderColumn > position + 1)
    .map((query) => ctx.app.historyQueryEngine.historyQueryRepository.order(query.id, query.orderColumn - 1))
  ctx.ok()
}

/**
 * Get status for the given HistoryQuery.
 * @param {Object} ctx - The KOA context
 * @return {Promise<void>} - The result promise
 */
const getStatus = async (ctx) => {
  const status = await ctx.app.historyQueryEngine.getStatusForHistoryQuery(ctx.params.id)
  ctx.ok(status)
}

export default {
  createHistoryQuery,
  getHistoryQueries,
  getHistoryQueryById,
  updateHistoryQuery,
  enableHistoryQuery,
  orderHistoryQuery,
  deleteHistoryQuery,
  getStatus,
}
