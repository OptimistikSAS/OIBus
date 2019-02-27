const Router = require('koa-router')
const koaSend = require('koa-send')

const configController = require('../controllers/configController')

const router = new Router()
// route for API server
router.get('/config', configController.getConfig)
// route for client bundle (static files)
router.get('/bundle.js', async ctx => koaSend(ctx, ctx.path, { root: `${__dirname}/../../../build` }))
router.get('/bundle.js.map', async ctx => koaSend(ctx, ctx.path, { root: `${__dirname}/../../../build` }))
router.get('/*', async ctx => koaSend(ctx, 'index.html', { root: `${__dirname}/../../../build` }))


module.exports = router
