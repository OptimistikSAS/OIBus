
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
function authRedefined(engine, opts = {}) {
  if (!opts.name && !opts.pass) throw new Error('Basic auth `name` and/or `pass` is required')

  if (!opts.realm) opts.realm = 'Secure Area'

  return function basicAuth(ctx, next) {
    const { user, password } = engine.config.engine

    if (!user || (opts.name && opts.name !== user) || (opts.pass && opts.pass !== password)) {
      return ctx.throw(401, null, { headers: { 'WWW-Authenticate': `Basic realm="${opts.realm.replace(/"/g, '\\"')}"` } })
    }
    return next()
  }
}

module.exports = authRedefined
