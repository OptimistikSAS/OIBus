const pointService = require('../../services/point.service')

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

module.exports = {
  exportPoints,
}
