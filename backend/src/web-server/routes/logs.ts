import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { logSchema } from '../controllers/validators/oibus-validation-schema';
import { Page } from '../../../shared/model/types';
import { LogDTO, Scope } from '../../../shared/model/logs.model';
import LogController from '../controllers/log.controller';

const joiValidator = new JoiValidator();
const logController = new LogController(joiValidator, logSchema);

const router = new Router();

router.get('/api/logs', (ctx: KoaContext<void, Page<LogDTO>>) => logController.search(ctx));
router.get('/api/scope-logs/suggestions', (ctx: KoaContext<void, Array<Scope>>) => logController.suggestScopes(ctx));
router.get('/api/scope-logs/:id', (ctx: KoaContext<void, Scope>) => logController.getScopeById(ctx));

export default router;
