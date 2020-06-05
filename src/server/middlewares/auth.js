/**
 * Module dependencies.
 */
const basicAuth = require('basic-auth')

const DEFAULT_PASSWORD = 'pass'

/**
 * Return basic auth middleware with
 * the given options:
 *
 *  - `name` username
 *  - `pass` password
 *  - `realm` realm
 *
 * @param {Object} opts - The options
 * @return {GeneratorFunction} The middleware function
 * @api public
 */
const auth = (opts = {}) => {
  if (!opts.realm) opts.realm = 'Secure Area'

  if (!opts.pass) {
    opts.pass = DEFAULT_PASSWORD
  }

  return (ctx, next) => {
    const user = basicAuth(ctx)
    if (user && user.pass && user.name === opts.name && user.pass === opts.pass) {
      return next()
    }
    return ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
  }
}

module.exports = auth
