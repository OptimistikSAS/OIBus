/**
 * Module dependencies.
 */
const crypto = require('crypto')
const basicAuth = require('basic-auth')

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
const auth = (opts = {}) => {
  if (!opts.realm) opts.realm = 'Secure Area'

  return (ctx, next) => {
    const user = basicAuth(ctx)
    if (user && user.pass && user.name === opts.name) {
      const hash = crypto.createHash('sha256').update(user.pass).digest('hex')
      if (hash === opts.pass) return next()
      ctx.app.logger.error('bad hash', hash)
    }
    return ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
  }
}

module.exports = auth
