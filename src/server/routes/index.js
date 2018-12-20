const Router = require('koa-router')

const indexController = require('../controllers/indexController')
const infoController = require('../controllers/infoController')

const router = new Router()

router.get('/', indexController.getIndex)
router.get('/infos', infoController.getInfo)

module.exports = router
