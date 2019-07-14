/**
 * Add North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addValues = async (ctx) => {
  if (ctx.app.engine.hasNorth(ctx.request.body.applicationId)) {
    ctx.throw(409, 'The given application ID already exists')
  }

  try {
    ctx.app.engine.addNorth(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to add new application')
  }
}

module.exports = { addValues }
