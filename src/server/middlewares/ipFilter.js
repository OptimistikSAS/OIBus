import micromatch from 'micromatch'

/**
 * Return ipFilter middleware:
 *
 * @param {string[]} filter - The filter
 * @return {Function} - The middleware function
 * @api public
 */
const ipFilter = (filter) => async (ctx, next) => {
  const { ip } = ctx.request
  if (micromatch.isMatch(ip, filter)) {
    await next()
  } else {
    ctx.app.logger.error(new Error(`${ip} is not authorized`))
    ctx.throw(401, 'access denied ', `IP ADDRESS UNAUTHORIZED. Please add '${ip}' in the IP Filter section of the OIBus Engine configuration`)
  }
}

export default ipFilter
