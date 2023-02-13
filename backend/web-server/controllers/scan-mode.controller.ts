import { KoaContext } from '../koa';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';
import AbstractController from './abstract.controller';

export default class ScanModeController extends AbstractController {
  async getScanModes(ctx: KoaContext<void, Array<ScanModeDTO>>): Promise<void> {
    const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();
    ctx.ok(scanModes);
  }

  async getScanMode(ctx: KoaContext<void, ScanModeDTO>): Promise<void> {
    const scanMode = ctx.app.repositoryService.scanModeRepository.getScanMode(ctx.params.id);
    if (scanMode) {
      ctx.ok(scanMode);
    } else {
      ctx.notFound();
    }
  }

  async createScanMode(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const scanMode = ctx.app.repositoryService.scanModeRepository.createScanMode(ctx.request.body as ScanModeCommandDTO);
      ctx.created(scanMode);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateScanMode(ctx: KoaContext<ScanModeCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.scanModeRepository.updateScanMode(ctx.params.id, ctx.request.body as ScanModeCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteScanMode(ctx: KoaContext<void, void>): Promise<void> {
    const scanMode = ctx.app.repositoryService.scanModeRepository.getScanMode(ctx.params.id);
    if (scanMode) {
      ctx.app.repositoryService.scanModeRepository.deleteScanMode(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
