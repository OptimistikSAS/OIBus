import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { userSchema } from '../controllers/validators/oibus-validation-schema';
import { Page } from '../../../shared/model/types';
import { ChangePasswordCommand, UserCommandDTO, UserDTO } from '../../../shared/model/user.model';
import UserController from '../controllers/user.controller';

const joiValidator = new JoiValidator();
const userController = new UserController(joiValidator, userSchema);

const router = new Router();

router.get('/api/users', (ctx: KoaContext<void, Page<UserDTO>>) => userController.search(ctx));
router.get('/api/users/:id', (ctx: KoaContext<void, UserDTO>) => userController.findById(ctx));
router.post('/api/users', (ctx: KoaContext<{ user: UserCommandDTO; password: string }, UserDTO>) => userController.create(ctx));
router.put('/api/users/:id', (ctx: KoaContext<UserCommandDTO, void>) => userController.update(ctx));
router.put('/api/users/:id/change-password', (ctx: KoaContext<ChangePasswordCommand, void>) => userController.updatePassword(ctx));
router.delete('/api/users/:id', (ctx: KoaContext<void, void>) => userController.delete(ctx));
export default router;
