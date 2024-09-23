import { KoaContext } from '../koa';
import { ChangePasswordCommand, User, UserCommandDTO, UserLight, UserSearchParam } from '../../../../shared/model/user.model';
import { Page } from '../../../../shared/model/types';
import AbstractController from './abstract.controller';

export default class UserController extends AbstractController {
  async search(ctx: KoaContext<void, Page<UserLight>>): Promise<void> {
    const searchParams: UserSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      login: (ctx.query.login as string) || null
    };
    const users = ctx.app.repositoryService.userRepository.search(searchParams);
    ctx.ok(users);
  }

  async findById(ctx: KoaContext<void, User>): Promise<void> {
    const user = ctx.app.repositoryService.userRepository.findById(ctx.params.id);
    if (user) {
      ctx.ok(user);
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<{ user: UserCommandDTO; password: string }, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body!.user);
      if (!ctx.request.body!.password) {
        return ctx.badRequest(`No password provided`);
      }
      const user = await ctx.app.repositoryService.userRepository.create(ctx.request.body!.user, ctx.request.body!.password);
      ctx.created(user);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<UserCommandDTO, void>) {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.userRepository.update(ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async changePassword(ctx: KoaContext<ChangePasswordCommand, void>) {
    try {
      if (!ctx.request.body || !ctx.request.body.newPassword) {
        return ctx.badRequest(`No password provided`);
      }
      await ctx.app.repositoryService.userRepository.updatePassword(ctx.params.id, ctx.request.body.newPassword);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    const user = ctx.app.repositoryService.userRepository.findById(ctx.params.id);
    if (user) {
      ctx.app.repositoryService.userRepository.delete(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
