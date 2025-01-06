import { KoaContext } from '../koa';
import { ChangePasswordCommand, UserCommandDTO, UserDTO, UserSearchParam } from '../../../shared/model/user.model';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';
import { toUserDTO } from '../../service/user.service';

export default class UserController extends AbstractController {
  async search(ctx: KoaContext<void, Page<UserDTO>>): Promise<void> {
    const searchParams: UserSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      login: (ctx.query.login as string) || undefined
    };
    const page = ctx.app.userService.search(searchParams);
    ctx.ok({
      content: page.content.map(element => toUserDTO(element)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async findById(ctx: KoaContext<void, UserDTO>): Promise<void> {
    const user = ctx.app.userService.findById(ctx.params.id);
    if (user) {
      ctx.ok(toUserDTO(user));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<{ user: UserCommandDTO; password: string }, UserDTO>): Promise<void> {
    try {
      const user = await ctx.app.userService.create(ctx.request.body!.user, ctx.request.body!.password);
      ctx.created(toUserDTO(user));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<UserCommandDTO, void>) {
    try {
      await ctx.app.userService.update(ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updatePassword(ctx: KoaContext<ChangePasswordCommand, void>) {
    try {
      await ctx.app.userService.updatePassword(ctx.params.id, ctx.request.body!.newPassword);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      ctx.app.userService.delete(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
