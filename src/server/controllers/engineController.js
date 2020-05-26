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
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.body contains the dataSourceId and the array of values
 * @return {void}
 */
const addValues = async (ctx) => {
  const { dataSourceId, values } = ctx.request.body
  try {
    console.info(values)
    ctx.app.engine.addValuesMessages += 1
    ctx.app.engine.addValuesCount += values ? values.length : 0
    await ctx.app.engine.addValues(dataSourceId, values)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, `Unable to add ${values ? values.length : '...'} from ${dataSourceId}`)
  }
}

module.exports = {
  getStatus,
  getNorthList,
  getSouthList,
  reload,
  addValues,
}
