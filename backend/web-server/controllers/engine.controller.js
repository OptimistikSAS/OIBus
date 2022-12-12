/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getOIBusInfo = async (ctx) => {
  const status = await ctx.app.engine.getOIBusInfo()
  ctx.ok(status)
}

/**
 * Get North List.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorthList = (ctx) => {
  ctx.ok(ctx.app.engine.getNorthList())
}

/**
 * Retrieve a specific North.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorth = (ctx) => {
  const connector = ctx.app.engine.getNorth(ctx.params.id)
  if (connector) {
    ctx.ok(connector)
  } else {
    throw ctx(404, `North connector ${ctx.params.id} not found`)
  }
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
 * Retrieve a specific North.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getSouth = (ctx) => {
  const connector = ctx.app.engine.getSouth(ctx.params.id)
  if (connector) {
    ctx.ok(connector)
  } else {
    throw ctx(404, `South connector ${ctx.params.id} not found`)
  }
}

/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.request.body - Array of values
 * @return {void}
 */
const addValues = async (ctx) => {
  const { name, dataSourceId } = ctx.request.query
  const dataSource = name || dataSourceId
  if (dataSource && Array.isArray(ctx.request.body)) {
    try {
      ctx.app.engine.addValuesMessages += 1
      ctx.app.engine.addValuesCount += ctx.request.body.length
      await ctx.app.engine.addValues(dataSource, ctx.request.body)
      ctx.ok()
    } catch (error) {
      ctx.throw(500, `Unable to add ${ctx.request.body.length} from ${dataSource}`)
    }
  } else {
    throw ctx.throw(400, 'Missing datasource name')
  }
}

/**
 * Add file to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.request.body - The file
 * @return {void}
 */
const addFile = async (ctx) => {
  const { name, dataSourceId } = ctx.request.query
  const dataSource = name || dataSourceId
  if (name) {
    try {
      ctx.app.engine.addFileCount += 1
      await ctx.app.engine.addFile(dataSource, ctx.request.file.path, false)
      ctx.ok()
    } catch (error) {
      ctx.throw(500, `Unable to add file from ${dataSource}`)
    }
  } else {
    throw ctx.throw(400, 'Missing dataSource name')
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
    await ctx.app.engine.healthSignal.forwardRequest(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to forward the aliveSignal request')
  }
}

export default {
  getOIBusInfo,
  getNorthList,
  getNorth,
  getSouthList,
  getSouth,
  addValues,
  addFile,
  aliveSignal,
}
