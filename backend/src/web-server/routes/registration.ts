import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { registrationSchema } from '../controllers/validators/oibus-validation-schema';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import OianalyticsRegistrationController from '../controllers/oianalytics-registration.controller';

const joiValidator = new JoiValidator();
const registrationController = new OianalyticsRegistrationController(joiValidator, registrationSchema);

const router = new Router();

router.get('/api/registration', (ctx: KoaContext<void, RegistrationSettingsDTO>) => registrationController.get(ctx));
router.put('/api/registration', (ctx: KoaContext<RegistrationSettingsCommandDTO, void>) => registrationController.register(ctx));
router.put('/api/registration/edit', (ctx: KoaContext<RegistrationSettingsCommandDTO, void>) =>
  registrationController.editConnectionSettings(ctx)
);
router.put('/api/registration/unregister', (ctx: KoaContext<void, void>) => registrationController.unregister(ctx));

export default router;
