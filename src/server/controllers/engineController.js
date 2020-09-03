/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const status = await ctx.app.engine.getStatus()
  ctx.ok(status)
}

/**
 * Get North list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorthList = (ctx) => {
  ctx.ok(ctx.app.engine.getNorthList())
}

/**
 * Get South list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getSouthList = (ctx) => {
  ctx.ok(ctx.app.engine.getSouthList())
}

/**
 * Reload OIBus.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const reload = async (ctx) => {
  await ctx.app.engine.reload(10000)

  ctx.ok('Reloading...')
}

/**
 * Shutdown OIBus.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const shutdown = async (ctx) => {
  await ctx.app.engine.shutdown(1000)

  ctx.ok('Shutting down...')
}

/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.request.body - Array of values
 * @return {void}
 */
const addValues = async (ctx) => {
  if (ctx.request.query.dataSourceId && Array.isArray(ctx.request.body)) {
    try {
      ctx.app.engine.addValuesMessages += 1
      ctx.app.engine.addValuesCount += ctx.request.body.length
      await ctx.app.engine.addValues(ctx.request.query.dataSourceId, ctx.request.body)
      ctx.ok()
    } catch (error) {
      ctx.throw(500, `Unable to add ${ctx.request.body.length} from ${ctx.request.query.dataSourceId}`)
    }
  } else {
    throw ctx(400, 'Missing dataSourceId')
  }
}

/**
 * Add file to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.request.body - The file
 * @return {void}
 */
const addFile = async (ctx) => {
  if (ctx.request.query.dataSourceId) {
    try {
      ctx.app.engine.addFileCount += 1
      await ctx.app.engine.addFile(ctx.request.query.dataSourceId, ctx.request.file.path, false)
      ctx.ok()
    } catch (error) {
      ctx.throw(500, `Unable to add file from ${ctx.request.query.dataSourceId}`)
    }
  } else {
    throw ctx(400, 'Missing dataSourceId')
  }
}

/**
 * Forward an aliveSignal request.
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.request.body - The aliveSignal content
 * @return {void}
 */
const aliveSignal = async (ctx) => {
  try {
    ctx.app.engine.aliveSignalMessages += 1
    await ctx.app.engine.aliveSignal.forwardRequest(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to forward the aliveSignal request')
  }
}

module.exports = {
  getStatus,
  getNorthList,
  getSouthList,
  reload,
  shutdown,
  addValues,
  addFile,
  aliveSignal,
}
