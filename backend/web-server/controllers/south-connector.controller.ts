import { KoaContext } from "../koa";
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthScanCommandDTO,
  SouthScanDTO,
} from "../../model/south-connector.model";

const getSouthConnectors = async (
  ctx: KoaContext<void, Array<SouthConnectorDTO>>
) => {
  const southConnectors =
    ctx.app.repositoryService.southConnectorRepository.getSouthConnectors();
  ctx.ok(southConnectors);
};

const getSouthConnector = async (ctx: KoaContext<void, SouthConnectorDTO>) => {
  const southConnector =
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector(
      ctx.params.id
    );
  ctx.ok(southConnector);
};

const createSouthConnector = async (
  ctx: KoaContext<SouthConnectorCommandDTO, void>
) => {
  const southConnector =
    ctx.app.repositoryService.southConnectorRepository.createSouthConnector(
      ctx.request.body
    );
  ctx.ok(southConnector);
};

const updateSouthConnector = async (
  ctx: KoaContext<SouthConnectorCommandDTO, void>
) => {
  ctx.app.repositoryService.southConnectorRepository.updateSouthConnector(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok();
};

const deleteSouthConnector = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.southConnectorRepository.deleteSouthConnector(
    ctx.params.id
  );
  ctx.ok();
};

const getSouthScans = async (ctx: KoaContext<void, Array<SouthScanDTO>>) => {
  const southScans =
    ctx.app.repositoryService.southScanRepository.getSouthScans(
      ctx.params.southId
    );
  ctx.ok(southScans);
};

const getSouthScan = async (ctx: KoaContext<void, SouthScanDTO>) => {
  const southScan = ctx.app.repositoryService.southScanRepository.getSouthScan(
    ctx.params.id
  );
  ctx.ok(southScan);
};

const createSouthScan = async (ctx: KoaContext<SouthScanCommandDTO, void>) => {
  const southScan =
    ctx.app.repositoryService.southScanRepository.createSouthScan(
      ctx.request.body
    );
  ctx.ok(southScan);
};

const updateSouthScan = async (ctx: KoaContext<SouthScanCommandDTO, void>) => {
  ctx.app.repositoryService.southScanRepository.updateSouthScan(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok();
};

const deleteSouthScan = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.southScanRepository.deleteSouthScan(ctx.params.id);
  ctx.ok();
};

export default {
  getSouthConnectors,
  getSouthConnector,
  createSouthConnector,
  updateSouthConnector,
  deleteSouthConnector,
  getSouthScans,
  getSouthScan,
  createSouthScan,
  updateSouthScan,
  deleteSouthScan,
};
