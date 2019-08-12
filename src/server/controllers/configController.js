/**
 * Get the active configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getActiveConfiguration = (ctx) => {
  ctx.ok({ config: ctx.app.engine.configService.getActiveConfiguration() })
}

/**
 * Get the modified configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getModifiedConfiguration = (ctx) => {
  ctx.ok({ config: ctx.app.engine.configService.getModifiedConfiguration() })
}

/**
 * Add North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addNorth = async (ctx) => {
  if (ctx.app.engine.configService.hasNorth(ctx.request.body.applicationId)) {
    ctx.throw(409, 'The given application ID already exists')
  }

  try {
    ctx.app.engine.configService.addNorth(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to add new application')
  }
}

/**
 * Update North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateNorth = (ctx) => {
  if (!ctx.app.engine.configService.hasNorth(ctx.params.applicationId)) {
    ctx.throw(404, 'The given application ID doesn\'t exists')
  }

  if (ctx.params.applicationId !== ctx.request.body.applicationId) {
    ctx.throw(400, 'Inconsistent application ID')
  }

  try {
    ctx.app.engine.configService.updateNorth(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to update application')
  }
}

/**
 * Delete North application.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const deleteNorth = (ctx) => {
  if (!ctx.app.engine.configService.hasNorth(ctx.params.applicationId)) {
    ctx.throw(404, 'The given application ID doesn\'t exists')
  }

  try {
    ctx.app.engine.configService.deleteNorth(ctx.params.applicationId)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to delete application')
  }
}

/**
 * Add South data source.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const addSouth = (ctx) => {
  if (ctx.app.engine.configService.hasSouth(ctx.request.body.dataSourceId)) {
    ctx.throw(409, 'The given data source ID already exists')
  }

  try {
    ctx.app.engine.configService.addSouth(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to add new data source')
  }
}

/**
 * Update South data source.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateSouth = (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (ctx.params.dataSourceId !== ctx.request.body.dataSourceId) {
    ctx.throw(400, 'Inconsistent data source ID')
  }

  try {
    ctx.app.engine.configService.updateSouth(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to update data source')
  }
}

/**
 * Delete South data source.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const deleteSouth = (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  try {
    ctx.app.engine.configService.deleteSouth(ctx.params.dataSourceId)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to delete data source')
  }
}

/**
 * Update Engine.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const updateEngine = (ctx) => {
  try {
    ctx.app.engine.configService.updateEngine(ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to update Engine')
  }
}

/**
 * Activate the configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const activateConfiguration = (ctx) => {
  try {
    ctx.app.engine.configService.activateConfiguration()
    ctx.ok('Reloading...')
  } catch (error) {
    ctx.throw(500, 'Unable to activate configuration')
  }
}

/**
 * Reset the configuration.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const resetConfiguration = (ctx) => {
  try {
    ctx.app.engine.configService.resetConfiguration()
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to reset configuration')
  }
}

module.exports = {
  getActiveConfiguration,
  getModifiedConfiguration,
  addNorth,
  updateNorth,
  deleteNorth,
  addSouth,
  updateSouth,
  deleteSouth,
  updateEngine,
  activateConfiguration,
  resetConfiguration,
}
