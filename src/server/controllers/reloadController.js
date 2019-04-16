const reload = (ctx) => {
  ctx.app.engine.reload(10000)

  ctx.ok('Reloading...')
}

module.exports = { reload }
