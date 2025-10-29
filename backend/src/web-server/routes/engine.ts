import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { contentSchema, engineSchema } from '../controllers/validators/oibus-validation-schema';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusContent, OIBusInfo } from '../../../shared/model/engine.model';
import EngineController from '../controllers/engine.controller';
import ContentController from '../controllers/content.controller';
import multer from '@koa/multer';

const joiValidator = new JoiValidator();
const engineController = new EngineController(joiValidator, engineSchema);
const contentController = new ContentController(joiValidator, contentSchema);

const router = new Router();
const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // Adjust field size limit as needed
    fileSize: 20 * 1024 * 1024 // Adjust file size limit as needed
  }
});

router.get('/api/engine', (ctx: KoaContext<void, EngineSettingsDTO>) => engineController.getEngineSettings(ctx));
router.put('/api/engine', (ctx: KoaContext<EngineSettingsCommandDTO, void>) => engineController.updateEngineSettings(ctx));
router.put('/api/engine/reset-metrics', (ctx: KoaContext<void, void>) => engineController.resetEngineMetrics(ctx));
router.put('/api/restart', (ctx: KoaContext<void, void>) => engineController.restart(ctx));
router.post('/api/add-content', upload.single('file'), (ctx: KoaContext<OIBusContent, void>) => contentController.addContent(ctx));
router.get('/api/info', (ctx: KoaContext<void, OIBusInfo>) => engineController.getOIBusInfo(ctx));
router.get('/api/status', (ctx: KoaContext<void, void>) => engineController.getStatus(ctx));

export default router;
