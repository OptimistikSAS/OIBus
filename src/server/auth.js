/**
 * Module dependencies.
 */
const crypto = require('crypto')
const auth = require('basic-auth')

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
module.exports = function (opts) {
  if (!opts.realm) opts.realm = 'Secure Area'

  return function basicAuth(ctx, next) {
    const user = auth(ctx)
    const hash = crypto.createHash('MD5', user.pass).digest('hex')
    if (user && user.name === opts.name && hash === opts.pass) {
      next()
    }
    ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
  }
}
