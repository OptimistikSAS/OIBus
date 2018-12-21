const VERSION = require('../../../package.json').version

const getIndex = (ctx) => {
  ctx.ok({ module: ' fTbus', VERSION })
}

module.exports = { getIndex }
