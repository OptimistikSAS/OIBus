import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { ipFilterSchema } from '../controllers/validators/oibus-validation-schema';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../shared/model/ip-filter.model';
import IpFilterController from '../controllers/ip-filter.controller';

const joiValidator = new JoiValidator();
const ipFilterController = new IpFilterController(joiValidator, ipFilterSchema);

const router = new Router();

router.get('/api/ip-filters', (ctx: KoaContext<void, Array<IPFilterDTO>>) => ipFilterController.findAll(ctx));
router.get('/api/ip-filters/:id', (ctx: KoaContext<void, IPFilterDTO>) => ipFilterController.findById(ctx));
router.post('/api/ip-filters', (ctx: KoaContext<IPFilterCommandDTO, IPFilterDTO>) => ipFilterController.create(ctx));
router.put('/api/ip-filters/:id', (ctx: KoaContext<IPFilterCommandDTO, void>) => ipFilterController.update(ctx));
router.delete('/api/ip-filters/:id', (ctx: KoaContext<void, void>) => ipFilterController.delete(ctx));

export default router;
