import { KoaContext } from '../koa';
import { User, UserCommandDTO, UserLight, UserSearchParam } from '../../../shared/model/user.model';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';

export default class UserController extends AbstractController {
  async searchUsers(ctx: KoaContext<void, Page<UserLight>>): Promise<void> {
    const searchParams: UserSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      login: (ctx.query.login as string) || null
    };
    const users = ctx.app.repositoryService.userRepository.searchUsers(searchParams);
    ctx.ok(users);
  }

  async getUser(ctx: KoaContext<void, User>): Promise<void> {
    const user = ctx.app.repositoryService.userRepository.getUserById(ctx.params.id);
    if (user) {
      ctx.ok(user);
    } else {
      ctx.notFound();
    }
  }

  async createUser(ctx: KoaContext<{ user: UserCommandDTO; password: string }, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body!.user);
      if (!ctx.request.body!.password) {
        return ctx.badRequest(`No password provided`);
      }
      const user = await ctx.app.repositoryService.userRepository.createUser(ctx.request.body!.user, ctx.request.body!.password);
      ctx.created(user);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateUser(ctx: KoaContext<UserCommandDTO, void>) {
    try {
      await this.validate(ctx.request.body);
      await ctx.app.repositoryService.userRepository.updateUser(ctx.params.id, ctx.request.body as UserCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async changePassword(ctx: KoaContext<string, void>) {
    try {
      if (!ctx.request.body) {
        return ctx.badRequest(`No password provided`);
      }
      await ctx.app.repositoryService.userRepository.updatePassword(ctx.params.id, ctx.request.body);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteUser(ctx: KoaContext<void, void>): Promise<void> {
    const ipFilter = ctx.app.repositoryService.userRepository.getUserById(ctx.params.id);
    if (ipFilter) {
      ctx.app.repositoryService.userRepository.deleteUser(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
