const Router = require('@koa/router')
const multer = require('@koa/multer')

const configController = require('../controllers/configController')
const logController = require('../controllers/logController')
const engineController = require('../controllers/engineController')

const router = new Router()

const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname)
  },
})
const upload = multer({ storage })

router.get('/config', configController.getActiveConfiguration)
router.put('/config', configController.updateConfig)
router.put('/config/activate', configController.activateConfiguration)

router.get('/config/schemas/north', engineController.getNorthList)
router.get('/config/schemas/south', engineController.getSouthList)
router.post('/engine/addValues', engineController.addValues)
router.post('/engine/addFile', upload.single('file'), engineController.addFile)
router.post('/engine/aliveSignal', engineController.aliveSignal)
router.get('/status', engineController.getStatus)
router.get('/status/south/:dataSourceId', engineController.getStatusForSouth)
router.get('/reload', engineController.reload)
router.get('/shutdown', engineController.shutdown)

router.get('/logs', logController.getLogs)

module.exports = router
