import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { commandSchema } from '../controllers/validators/oibus-validation-schema';
import OianalyticsCommandController from '../controllers/oianalytics-command.controller';
import { Page } from '../../../shared/model/types';
import { OIBusCommandDTO } from '../../../shared/model/command.model';

const joiValidator = new JoiValidator();
const commandController = new OianalyticsCommandController(joiValidator, commandSchema);

const router = new Router();

router.get('/api/commands', (ctx: KoaContext<void, Page<OIBusCommandDTO>>) => commandController.search(ctx));
router.delete('/api/commands/:id', (ctx: KoaContext<void, void>) => commandController.delete(ctx));

export default router;
