/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.body contains the dataSourceId and the array of values
 * @return {void}
 */
const addValues = async (ctx) => {
  const { dataSourceId, values } = ctx.request.body
  try {
    await ctx.app.engine.addValues(dataSourceId, values)
    ctx.ok()
  } catch (error) {
    console.error(error)
    ctx.throw(500, `Unable to add ${values ? values.length : '...'} from ${dataSourceId}`)
  }
}

module.exports = { addValues }
