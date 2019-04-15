/**
 * Get the configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getConfig = (ctx) => {
  ctx.ok({ config: ctx.app.engine.config })
}

/**
 * Add North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addNorth = (ctx) => {
  ctx.ok()
}

/**
 * Update North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateNorth = (ctx) => {
  ctx.ok()
}

/**
 * Add South equipment.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addSouth = (ctx) => {
  ctx.ok()
}

/**
 * Update South equipment.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateSouth = (ctx) => {
  ctx.ok()
}

module.exports = {
  getConfig,
  addNorth,
  updateNorth,
  addSouth,
  updateSouth,
}
