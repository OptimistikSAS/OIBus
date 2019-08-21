const pointService = require('../../services/point.service')

/**
 * Get points for a given South.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const getPoints = (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  ctx.ok(ctx.app.engine.configService.getPointsForSouth(ctx.params.dataSourceId))
}

/**
 * Add point to a given South.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @param {object} ctx.body - The request body
 * @param {string} ctx.body.pointId - The point ID
 * @param {string} ctx.body.scanMode - The scan mode
 * @return {void}
 */
const addPoint = (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.request.body.pointId || !ctx.request.body.scanMode) {
    ctx.throw(400, 'Missing parameters')
  }

  if (ctx.app.engine.configService.hasSouthPoint(ctx.params.dataSourceId, ctx.request.body.pointId)) {
    ctx.throw(409, 'Point with the given ID already exists')
  }

  try {
    ctx.app.engine.configService.addSouthPoint(ctx.params.dataSourceId, ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to add new point')
  }
}

/**
 * Update point.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @param {string} ctx.params.pointId - The point ID
 * @param {object} ctx.body - The request body
 * @param {string} ctx.body.pointId - The point ID
 * @param {string} ctx.body.scanMode - The scan mode
 * @return {void}
 */
const updatePoint = (ctx) => {
  const pointId = decodeURIComponent(ctx.params.pointId)

  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.app.engine.configService.hasSouthPoint(ctx.params.dataSourceId, pointId)) {
    ctx.throw(404, 'The given point ID doesn\'t exists')
  }

  if (!ctx.request.body.pointId || !ctx.request.body.scanMode) {
    ctx.throw(400, 'Missing parameters')
  }

  try {
    ctx.app.engine.configService.updateSouthPoint(ctx.params.dataSourceId, pointId, ctx.request.body)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to update point')
  }
}

/**
 * Delete point.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const deletePoint = async (ctx) => {
  const pointId = decodeURIComponent(ctx.params.pointId)

  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.app.engine.configService.hasSouthPoint(ctx.params.dataSourceId, pointId)) {
    ctx.throw(404, 'The given point ID doesn\'t exists')
  }

  try {
    ctx.app.engine.configService.deleteSouthPoint(ctx.params.dataSourceId, pointId)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to delete point')
  }
}

/**
 * Delete all points from a given North.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const deleteAllPoints = (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  try {
    ctx.app.engine.configService.deleteSouthPoints(ctx.params.dataSourceId)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, 'Unable to delete points')
  }
}

/**
 * Delete North application.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const exportPoints = async (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  try {
    const points = ctx.app.engine.configService.getPointsForSouth(ctx.params.dataSourceId)
    ctx.set('Content-disposition', `attachment; filename=${ctx.params.dataSourceId}.csv`)
    ctx.body = await pointService.exportToCSV(points)
  } catch (error) {
    ctx.throw(500, 'Unable to export points')
  }
}

/**
 * Add South data source.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @param {object} ctx.request - The request object
 * @param {string} ctx.request.body - The request body
 * @return {void}
 */
const importPoints = async (ctx) => {
  if (!ctx.app.engine.configService.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }
  let points
  try {
    points = await pointService.importFromCSV(ctx.request.body)
  } catch (error) {
    ctx.throw(500, 'Unable to import points')
  }

  const duplicateIds = pointService.getDuplicateIds(points)
  if (duplicateIds.length) {
    ctx.throw(409, `Duplicate ids: ${duplicateIds.join(',')}`)
  }

  const scanModes = ctx.app.engine.configService.getScanModes()
  const invalidScanModes = pointService.getInvalidScanModes(points, scanModes)
  if (invalidScanModes.length) {
    ctx.throw(400, `Invalid scan modes: ${invalidScanModes.join(',')}`)
  }

  ctx.app.engine.configService.setSouthPoints(ctx.params.dataSourceId, points)
  ctx.body = points
}

module.exports = {
  getPoints,
  addPoint,
  updatePoint,
  deletePoint,
  deleteAllPoints,
  exportPoints,
  importPoints,
}
