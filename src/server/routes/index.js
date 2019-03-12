const Router = require('koa-router')

const configController = require('../controllers/configController')

const router = new Router()
router.get('/config', configController.getConfig)

router.get('/reload', (ctx) => {
  ctx.ok('Reloading...')

  process.exit(1)
})

module.exports = router
