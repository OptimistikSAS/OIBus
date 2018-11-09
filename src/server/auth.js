const bcrypt = require('bcrypt')
const auth = require('basic-auth')

/**
 * Return redefined auth middleware with
 * the given options:
 *  - Engine
 *  - `name` username
 *  - `pass` password
 *  - `realm` realm
 *
 * @param {Object} opts
 * @return {GeneratorFunction}
 * @api public
 */
function authRedefined(opts = {}) {
  if (!opts.name && !opts.pass) throw new Error('Basic auth `name` and/or `pass` is required')

  if (!opts.realm) opts.realm = 'Secure Area'

  return function basicAuth(ctx, next) {
    const user = auth(ctx)
    const { name, pass } = user
    const saltRounds = 10
    const hash = bcrypt.hashSync(pass, saltRounds)
    if (!user || (opts.name && opts.name !== name) || (opts.pass && opts.pass !== hash)) {
      return ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
    }
    return next()
  }
}

module.exports = authRedefined
