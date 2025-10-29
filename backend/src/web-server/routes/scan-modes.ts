import Router from '@koa/router';
import { KoaContext } from '../koa';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import ScanModeController from '../controllers/scan-mode.controller';
import JoiValidator from '../controllers/validators/joi.validator';
import { scanModeSchema } from '../controllers/validators/oibus-validation-schema';

const joiValidator = new JoiValidator();
const scanModeController = new ScanModeController(joiValidator, scanModeSchema);

const router = new Router();

router.get('/api/scan-modes', (ctx: KoaContext<void, Array<ScanModeDTO>>) => scanModeController.findAll(ctx));
router.post('/api/scan-modes/verify', (ctx: KoaContext<{ cron: string }, ValidatedCronExpression>) => scanModeController.verifyCron(ctx));
router.get('/api/scan-modes/:id', (ctx: KoaContext<void, ScanModeDTO>) => scanModeController.findById(ctx));
router.post('/api/scan-modes', (ctx: KoaContext<ScanModeCommandDTO, void>) => scanModeController.create(ctx));
router.put('/api/scan-modes/:id', (ctx: KoaContext<ScanModeCommandDTO, void>) => scanModeController.update(ctx));
router.delete('/api/scan-modes/:id', (ctx: KoaContext<void, void>) => scanModeController.delete(ctx));

export default router;
