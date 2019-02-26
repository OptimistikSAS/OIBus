const Router = require('koa-router')
const koaSend = require('koa-send')

const indexController = require('../controllers/indexController')
const infoController = require('../controllers/infoController')

const router = new Router()

// route for client bundle (static files)
router.get('/index.html', async ctx => koaSend(ctx, ctx.path, { root: `${__dirname}/../../../build` }))
router.get('/bundle.js', async ctx => koaSend(ctx, ctx.path, { root: `${__dirname}/../../../build` }))
router.get('/bundle.js.map', async ctx => koaSend(ctx, ctx.path, { root: `${__dirname}/../../../build` }))
// route for API server
router.get('/', indexController.getIndex)
router.get('/infos', infoController.getInfo)

module.exports = router
