import { KoaContext } from "../koa";
import { ScanModeCommandDTO, ScanModeDTO } from "../../model/scan-mode.model";

const getScanModes = async (ctx: KoaContext<void, Array<ScanModeDTO>>) => {
  const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();
  ctx.ok(scanModes);
};

const getScanMode = async (ctx: KoaContext<void, ScanModeDTO>) => {
  const scanMode = ctx.app.repositoryService.scanModeRepository.getScanMode(
    ctx.params.id
  );
  ctx.ok(scanMode);
};

const createScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  const scanMode = ctx.app.repositoryService.scanModeRepository.createScanMode(
    ctx.request.body
  );
  ctx.ok(scanMode);
};

const updateScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  ctx.app.repositoryService.scanModeRepository.updateScanMode(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok();
};

const deleteScanMode = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.scanModeRepository.deleteScanMode(ctx.params.id);
  ctx.ok();
};

export default {
  getScanModes,
  getScanMode,
  createScanMode,
  updateScanMode,
  deleteScanMode,
};
