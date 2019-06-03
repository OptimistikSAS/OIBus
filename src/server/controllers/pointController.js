const pointService = require('../../services/point.service')

/**
 * Get points for a given South.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const getPoints = (ctx) => {
  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  ctx.ok(ctx.app.engine.getPointsForSouth(ctx.params.dataSourceId))
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
  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.request.body.pointId || !ctx.request.body.scanMode) {
    ctx.throw(400, 'Missing parameters')
  }

  if (ctx.app.engine.hasSouthPoint(ctx.params.dataSourceId, ctx.request.body.pointId)) {
    ctx.throw(409, 'Point with the given ID already exists')
  }

  try {
    ctx.app.engine.addSouthPoint(ctx.params.dataSourceId, ctx.request.body)
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

  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.app.engine.hasSouthPoint(ctx.params.dataSourceId, pointId)) {
    ctx.throw(404, 'The given point ID doesn\'t exists')
  }

  if (!ctx.request.body.pointId || !ctx.request.body.scanMode) {
    ctx.throw(400, 'Missing parameters')
  }

  try {
    ctx.app.engine.updateSouthPoint(ctx.params.dataSourceId, ctx.request.body)
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

  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  if (!ctx.app.engine.hasSouthPoint(ctx.params.dataSourceId, pointId)) {
    ctx.throw(404, 'The given point ID doesn\'t exists')
  }

  try {
    ctx.app.engine.deleteSouthPoint(ctx.params.dataSourceId, pointId)
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
  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  try {
    ctx.app.engine.deleteSouthPoints(ctx.params.dataSourceId)
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
  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  try {
    const points = ctx.app.engine.getPointsForSouth(ctx.params.dataSourceId)
    const csv = await pointService.exportToCSV(points)
    ctx.ok(csv)
  } catch (error) {
    ctx.throw(500, 'Unable to export points')
  }
}

/**
 * Add South data source.
 * @param {object} ctx - The KOA context
 * @param {object} ctx.params - The request parameters
 * @param {string} ctx.params.dataSourceId - The data source ID
 * @return {void}
 */
const importPoints = (ctx) => {
  if (!ctx.app.engine.hasSouth(ctx.params.dataSourceId)) {
    ctx.throw(404, 'The given data source ID doesn\'t exists')
  }

  ctx.ok()
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
