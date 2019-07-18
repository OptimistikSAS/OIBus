/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addValues = async (ctx) => {
  try {
    ctx.app.engine.addValues(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to add values')
  }
}

module.exports = { addValues }
