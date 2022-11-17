/**
 * Retrieve error files.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const getFileErrors = async (ctx) => {
  const north = ctx.app.engine.activeNorths.find((activeNorth) => activeNorth.id === ctx.params.id)
  if (!north) {
    ctx.throw(404, 'North not found')
  }

  const now = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const fromDate = ctx.query.fromDate || weekAgo.toISOString()
  const toDate = ctx.query.toDate || now.toISOString()
  const fileNameContains = ctx.query.fileNameContains || ''
  const pageNumber = ctx.query.pageNumber || 1

  const errorFiles = await north.getErrorFiles(fromDate, toDate, fileNameContains, pageNumber)
  ctx.ok(errorFiles)
}

/**
 * Remove the list of given filenames.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const removeFileErrors = async (ctx) => {
  const north = ctx.app.engine.activeNorths.find((activeNorth) => activeNorth.id === ctx.params.id)
  if (!north) {
    ctx.throw(404, 'North not found')
  }

  if (!Array.isArray(ctx.request.body)) {
    ctx.throw(400, 'Invalid file list')
  }

  await north.removeErrorFiles(ctx.request.body)

  ctx.ok('Error files removed')
}

/**
 * Retry the list of given filenames.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const retryFileErrors = async (ctx) => {
  const north = ctx.app.engine.activeNorths.find((activeNorth) => activeNorth.id === ctx.params.id)
  if (!north) {
    ctx.throw(404, 'North not found')
  }

  if (!Array.isArray(ctx.request.body)) {
    ctx.throw(400, 'Invalid file list')
  }

  await north.retryErrorFiles(ctx.request.body)

  ctx.ok('Error files retried')
}

/**
 * Remove all error files.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const removeAllFileErrors = async (ctx) => {
  const north = ctx.app.engine.activeNorths.find((activeNorth) => activeNorth.id === ctx.params.id)
  if (!north) {
    ctx.throw(404, 'North not found')
  }

  await north.removeAllErrorFiles()

  ctx.ok('All error files removed')
}

/**
 * Retry all error files.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const retryAllFileErrors = async (ctx) => {
  const north = ctx.app.engine.activeNorths.find((activeNorth) => activeNorth.id === ctx.params.id)
  if (!north) {
    ctx.throw(404, 'North not found')
  }

  await north.retryAllErrorFiles()

  ctx.ok('All error files retried')
}

module.exports = {
  getFileErrors,
  removeFileErrors,
  retryFileErrors,
  removeAllFileErrors,
  retryAllFileErrors,
}
