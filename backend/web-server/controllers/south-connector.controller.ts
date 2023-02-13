import { KoaContext } from '../koa';

import adsManifest from '../../south/south-ads/manifest';
import folderScannerManifest from '../../south/south-folder-scanner/manifest';
import modbusManifest from '../../south/south-modbus/manifest';
import mqttManifest from '../../south/south-mqtt/manifest';
import opchdaManifest from '../../south/south-opchda/manifest';
import opcuaDaManifest from '../../south/south-opcua-da/manifest';
import opcuaHaManifest from '../../south/south-opcua-ha/manifest';
import restManifest from '../../south/south-rest/manifest';
import sqlManifest from '../../south/south-sql/manifest';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthItemCommandDTO,
  SouthItemDTO,
  SouthItemSearchParam,
  SouthType
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import JoiValidator from '../../validators/joi.validator';

// TODO: retrieve south types from a local store
const manifests = [
  sqlManifest,
  restManifest,
  opcuaHaManifest,
  opcuaDaManifest,
  opchdaManifest,
  mqttManifest,
  modbusManifest,
  folderScannerManifest,
  adsManifest
];

export default class SouthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getSouthConnectorTypes(ctx: KoaContext<void, Array<SouthType>>): Promise<void> {
    ctx.ok(
      manifests.map(connector => ({
        category: connector.category,
        type: connector.name,
        description: connector.description,
        modes: connector.modes
      }))
    );
  }

  async getSouthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = manifests.find(south => south.name === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'South not found');
    }
    ctx.ok(manifest);
  }

  async getSouthConnectors(ctx: KoaContext<void, Array<SouthConnectorDTO>>): Promise<void> {
    const southConnectors = ctx.app.repositoryService.southConnectorRepository.getSouthConnectors();
    ctx.ok(southConnectors);
  }

  async getSouthConnector(ctx: KoaContext<void, SouthConnectorDTO>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
    if (southConnector) {
      ctx.ok(southConnector);
    } else {
      ctx.notFound();
    }
  }

  async createSouthConnector(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = manifests.find(south => south.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validate(manifest.schema, ctx.request.body);

      const command: SouthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        const southConnector = ctx.app.repositoryService.southConnectorRepository.createSouthConnector(command);
        ctx.created(southConnector);
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthConnector(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = manifests.find(south => south.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'South not found');
      }

      await this.validator.validate(manifest.schema, ctx.request.body);

      const command: SouthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        ctx.app.repositoryService.southConnectorRepository.updateSouthConnector(ctx.params.id, command);
        ctx.noContent();
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteSouthConnector(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.repositoryService.southConnectorRepository.deleteSouthConnector(ctx.params.id);
    ctx.noContent();
  }

  async searchSouthItems(ctx: KoaContext<void, Page<SouthItemDTO>>): Promise<void> {
    const searchParams: SouthItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: (ctx.query.name as string) || null
    };
    const southItems = ctx.app.repositoryService.southItemRepository.searchSouthItems(ctx.params.southId, searchParams);
    ctx.ok(southItems);
  }

  async getSouthItem(ctx: KoaContext<void, SouthItemDTO>): Promise<void> {
    const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
    if (southItem) {
      ctx.ok(southItem);
    } else {
      ctx.notFound();
    }
  }

  async createSouthItem(ctx: KoaContext<SouthItemCommandDTO, SouthItemDTO>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.throw(404, 'South not found');
    }

    const manifest = manifests.find(south => south.name === southConnector.type);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const command: SouthItemCommandDTO | undefined = ctx.request.body;
    if (command) {
      await this.validator.validate(manifest.items.schema, command);

      const southItem = ctx.app.repositoryService.southItemRepository.createSouthItem(ctx.params.southId, command);
      ctx.created(southItem);
    } else {
      ctx.badRequest();
    }
  }

  async updateSouthItem(ctx: KoaContext<SouthItemCommandDTO, void>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.throw(404, 'South not found');
    }

    const manifest = manifests.find(south => south.name === southConnector.type);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
    if (southItem) {
      const command: SouthItemCommandDTO | undefined = ctx.request.body;
      if (command) {
        await this.validator.validate(manifest.items.schema, command);

        ctx.app.repositoryService.southItemRepository.updateSouthItem(ctx.params.id, command);
        ctx.noContent();
      } else {
        ctx.badRequest();
      }
    } else {
      ctx.notFound();
    }
  }

  async deleteSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.repositoryService.southItemRepository.deleteSouthItem(ctx.params.id);
    ctx.noContent();
  }
}
