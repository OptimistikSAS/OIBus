import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { transformerSchema } from '../controllers/validators/oibus-validation-schema';
import { CustomTransformerCommand, TransformerDTO } from '../../../shared/model/transformer.model';
import TransformerController from '../controllers/transformer.controller';

const joiValidator = new JoiValidator();
const transformerController = new TransformerController(joiValidator, transformerSchema);

const router = new Router();

router.get('/api/transformers', (ctx: KoaContext<void, Array<TransformerDTO>>) => transformerController.findAll(ctx));
router.get('/api/transformers/:id', (ctx: KoaContext<void, TransformerDTO>) => transformerController.findById(ctx));
router.post('/api/transformers', (ctx: KoaContext<CustomTransformerCommand, TransformerDTO>) => transformerController.create(ctx));
router.put('/api/transformers/:id', (ctx: KoaContext<CustomTransformerCommand, void>) => transformerController.update(ctx));
router.delete('/api/transformers/:id', (ctx: KoaContext<void, void>) => transformerController.delete(ctx));

export default router;
