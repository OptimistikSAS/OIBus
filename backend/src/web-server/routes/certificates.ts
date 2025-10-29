import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { certificateSchema } from '../controllers/validators/oibus-validation-schema';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import CertificateController from '../controllers/certificate.controller';

const joiValidator = new JoiValidator();
const certificateController = new CertificateController(joiValidator, certificateSchema);

const router = new Router();

router.get('/api/certificates', (ctx: KoaContext<void, Array<CertificateDTO>>) => certificateController.findAll(ctx));
router.get('/api/certificates/:id', (ctx: KoaContext<void, CertificateDTO>) => certificateController.findById(ctx));
router.post('/api/certificates', (ctx: KoaContext<CertificateCommandDTO, void>) => certificateController.create(ctx));
router.put('/api/certificates/:id', (ctx: KoaContext<CertificateCommandDTO, void>) => certificateController.update(ctx));
router.delete('/api/certificates/:id', (ctx: KoaContext<void, void>) => certificateController.delete(ctx));
export default router;
