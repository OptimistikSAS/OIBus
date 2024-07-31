import { KoaContext } from '../koa';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import AbstractController from './abstract.controller';
import { validateCronExpression } from '../../service/utils';

export default class ScanModeController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<ScanModeDTO>>): Promise<void> {
    const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();
    ctx.ok(scanModes);
  }

  async verifyScanMode(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      if (!ctx.request.body?.cron) {
        ctx.badRequest('Cron expression is required');
        return;
      }

      const expression = validateCronExpression(ctx.request.body.cron);
      ctx.ok(expression);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async findById(ctx: KoaContext<void, ScanModeDTO>): Promise<void> {
    const scanMode = ctx.app.repositoryService.scanModeRepository.findById(ctx.params.id);
    if (scanMode) {
      ctx.ok(scanMode);
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      const scanMode = await ctx.app.scanModeConfigService.create(ctx.request.body!);
      ctx.created(scanMode);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async update(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.scanModeConfigService.update(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.scanModeConfigService.delete(ctx.params.id!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }
}
