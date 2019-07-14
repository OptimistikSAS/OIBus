/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addValues = async (ctx) => {
  const { dataSourceId, values, urgent } = ctx.request.body
  try {
    ctx.app.engine.addValues(dataSourceId, values, urgent)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, `Unable to add values from ${dataSourceId}`)
  }
}

module.exports = { addValues }
