import { KoaContext } from "../koa";
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthItemCommandDTO,
  SouthItemDTO,
  SouthItemSearchParam,
  SouthType,
} from "../../model/south-connector.model";

import adsManifest from "../../south/south-ads/manifest";
import folderScannerManifest from "../../south/south-folder-scanner/manifest";
import modbusManifest from "../../south/south-modbus/manifest";
import mqttManifest from "../../south/south-mqtt/manifest";
import opchdaManifest from "../../south/south-opchda/manifest";
import opcuaDaManifest from "../../south/south-opcua-da/manifest";
import opcuaHaManifest from "../../south/south-opcua-ha/manifest";
import restManifest from "../../south/south-rest/manifest";
import sqlManifest from "../../south/south-sql/manifest";
import { Page } from "../../model/types";

// TODO: retrieve south types from a local store
const manifest = [
  sqlManifest,
  restManifest,
  opcuaHaManifest,
  opcuaDaManifest,
  opchdaManifest,
  mqttManifest,
  modbusManifest,
  folderScannerManifest,
  adsManifest,
];

const getSouthConnectorTypes = async (
  ctx: KoaContext<void, Array<SouthType>>
) => {
  ctx.ok(
    manifest.map((connector) => ({
      category: connector.category,
      type: connector.name,
      description: connector.description,
      modes: connector.modes,
    }))
  );
};

const getSouthConnectorManifest = async (ctx: KoaContext<void, object>) => {
  const connector = manifest.find((south) => south.name === ctx.params.id);
  if (!connector) {
    ctx.throw(404, "North not found");
  }
  ctx.ok(connector);
};

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
  ctx.created(southConnector);
};

const updateSouthConnector = async (
  ctx: KoaContext<SouthConnectorCommandDTO, void>
) => {
  ctx.app.repositoryService.southConnectorRepository.updateSouthConnector(
    ctx.params.id,
    ctx.request.body
  );
  ctx.noContent({});
};

const deleteSouthConnector = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.southConnectorRepository.deleteSouthConnector(
    ctx.params.id
  );
  ctx.noContent();
};

const searchSouthItems = async (ctx: KoaContext<void, Page<SouthItemDTO>>) => {
  const searchParams: SouthItemSearchParam = {
    page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
    name: (ctx.query.name as string) || null,
  };
  const southScans =
    ctx.app.repositoryService.southItemRepository.searchSouthItems(
      ctx.params.southId,
      searchParams
    );
  ctx.ok(southScans);
};

const getSouthItem = async (ctx: KoaContext<void, SouthItemDTO>) => {
  const southScan = ctx.app.repositoryService.southItemRepository.getSouthItem(
    ctx.params.id
  );
  ctx.ok(southScan);
};

const createSouthItem = async (
  ctx: KoaContext<SouthItemCommandDTO, SouthItemDTO>
) => {
  const southScan =
    ctx.app.repositoryService.southItemRepository.createSouthItem(
      ctx.params.southId,
      ctx.request.body
    );
  ctx.created(southScan);
};

const updateSouthItem = async (ctx: KoaContext<SouthItemCommandDTO, void>) => {
  ctx.app.repositoryService.southItemRepository.updateSouthItem(
    ctx.params.id,
    ctx.request.body
  );
  ctx.noContent({});
};

const deleteSouthItem = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.southItemRepository.deleteSouthItem(ctx.params.id);
  ctx.noContent();
};

export default {
  getSouthConnectorTypes,
  getSouthConnectorManifest,
  getSouthConnectors,
  getSouthConnector,
  createSouthConnector,
  updateSouthConnector,
  deleteSouthConnector,
  searchSouthItems,
  getSouthItem,
  createSouthItem,
  updateSouthItem,
  deleteSouthItem,
};
