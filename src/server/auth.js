const crypto = require('crypto')


/**
 * Module dependencies.
 */

const auth = require('koa-basic-auth')

/**
 * Return basic auth middleware with
 * the given options:
 *
 *  - `name` username
 *  - `pass` password
 *  - `realm` realm
 *
 * @param {Object} opts
 * @return {GeneratorFunction}
 * @api public
 */

const authCrpto = (opts = {}) => {
  if (!opts.name && !opts.pass) throw new Error('Basic auth `name` and/or `pass` is required')

  if (!opts.realm) opts.realm = 'Secure Area'

  return function basicAuth(ctx, next) {
    const user = auth(ctx)
    const hash = crypto.createHash('MD5', user.pass).digest('hex')
    if (!user || (opts.name && opts.name !== user.name) || (opts.pass && opts.pass !== hash)) {
      return ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
    }
    return next()
  }
}
module.exports = authCrpto
