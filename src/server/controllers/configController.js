const getConfig = (ctx) => {
  ctx.ok({ config: ctx.app.engine.config })
}

module.exports = { getConfig }
