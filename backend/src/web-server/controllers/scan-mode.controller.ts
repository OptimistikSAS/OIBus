import { KoaContext } from '../koa';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';
import AbstractController from './abstract.controller';
import { toScanModeDTO } from '../../service/scan-mode.service';

export default class ScanModeController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<ScanModeDTO>>): Promise<void> {
    const scanModes = ctx.app.scanModeService.findAll().map(scanMode => toScanModeDTO(scanMode));
    ctx.ok(scanModes);
  }

  async findById(ctx: KoaContext<void, ScanModeDTO>): Promise<void> {
    const scanMode = ctx.app.scanModeService.findById(ctx.params.id);
    if (scanMode) {
      ctx.ok(toScanModeDTO(scanMode));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      const scanMode = await ctx.app.scanModeService.create(ctx.request.body!);
      ctx.created(toScanModeDTO(scanMode));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.scanModeService.update(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.scanModeService.delete(ctx.params.id!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async verifyCron(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      const expression = await ctx.app.scanModeService.verifyCron(ctx.request.body!);
      ctx.ok(expression);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
