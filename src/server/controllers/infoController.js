const getInfo = (ctx) => {
  ctx.ok({ config: ctx.app.engine.config })
}

module.exports = { getInfo }
