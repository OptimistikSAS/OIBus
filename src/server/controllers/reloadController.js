const reload = (ctx) => {
  ctx.ok('Reloading...')

  setTimeout(() => {
    process.exit(1)
  }, 1000)
}

module.exports = { reload }
