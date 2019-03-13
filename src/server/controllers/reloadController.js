const reload = (ctx) => {
  ctx.app.engine.stop()

  setTimeout(() => {
    process.exit(1)
  }, 10000)

  ctx.ok('Reloading...')
}

module.exports = { reload }
