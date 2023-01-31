import { KoaContext } from '../koa';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';

const getScanModes = async (ctx: KoaContext<void, Array<ScanModeDTO>>) => {
  const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();
  ctx.ok(scanModes);
};

const getScanMode = async (ctx: KoaContext<void, ScanModeDTO>) => {
  const scanMode = ctx.app.repositoryService.scanModeRepository.getScanMode(ctx.params.id);
  ctx.ok(scanMode);
};

const createScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  const command: ScanModeCommandDTO | undefined = ctx.request.body;
  if (command) {
    const scanMode = ctx.app.repositoryService.scanModeRepository.createScanMode(command);
    ctx.created(scanMode);
  } else {
    ctx.badRequest();
  }
};

const updateScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  const command: ScanModeCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.scanModeRepository.updateScanMode(ctx.params.id, command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

const deleteScanMode = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.scanModeRepository.deleteScanMode(ctx.params.id);
  ctx.noContent();
};

export default {
  getScanModes,
  getScanMode,
  createScanMode,
  updateScanMode,
  deleteScanMode
};
