/**
 * Module dependencies.
 */
const micromatch = require('micromatch')

/**
 * Return ipFilter middleware:
 *
 * @param {Array} filter - The filter
 * @return {GeneratorFunction} The middleware function
 * @api public
 */
const ipFilter = (filter) => (ctx, next) => {
  const { ip } = ctx.request
  if (micromatch.isMatch(ip, filter)) {
    return next()
  }
  ctx.app.logger.error(new Error(`${ip} is not authorized`))
  return ctx.throw(401, 'access denied ', `${ip} is not authorized`)
}

module.exports = ipFilter
