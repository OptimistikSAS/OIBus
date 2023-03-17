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
  OibusItemCommandDTO,
  OibusItemDTO,
  OibusItemSearchParam,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import JoiValidator from '../../validators/joi.validator';

// TODO: retrieve south types from a local store
export const southManifests = [
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
      southManifests.map(connector => ({
        category: connector.category,
        type: connector.name,
        description: connector.description,
        modes: connector.modes
      }))
    );
  }

  async getSouthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = southManifests.find(south => south.name === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'South not found');
    }
    ctx.ok(manifest);
  }

  async getSouthConnectors(ctx: KoaContext<void, Array<SouthConnectorDTO>>): Promise<void> {
    const southConnectors = ctx.app.repositoryService.southConnectorRepository.getSouthConnectors();
    ctx.ok(
      southConnectors.map(connector => {
        const manifest = southManifests.find(south => south.name === connector.type);
        if (manifest) {
          connector.settings = ctx.app.encryptionService.filterSecrets(connector.settings, manifest.settings);
          return connector;
        }
        return null;
      })
    );
  }

  async getSouthConnector(ctx: KoaContext<void, SouthConnectorDTO>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
    if (southConnector) {
      const manifest = southManifests.find(south => south.name === southConnector.type);
      if (manifest) {
        southConnector.settings = ctx.app.encryptionService.filterSecrets(southConnector.settings, manifest.settings);
        ctx.ok(southConnector);
      } else {
        ctx.throw(404, 'South type not found');
      }
    } else {
      ctx.notFound();
    }
  }

  async createSouthConnector(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = southManifests.find(south => south.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validate(manifest.schema, ctx.request.body?.settings);

      const command: SouthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        const encryptedCommand = await ctx.app.encryptionService.encryptConnectorSecrets(command, null, manifest.settings);
        const southConnector = await ctx.app.reloadService.onCreateSouth(encryptedCommand as SouthConnectorCommandDTO);
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
      const manifest = southManifests.find(south => south.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }
      await this.validator.validate(manifest.schema, ctx.request.body?.settings);

      const southSettings = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
      if (!southSettings) {
        return ctx.notFound();
      }
      const command: SouthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
          command.settings,
          southSettings.settings,
          manifest.settings
        );
        await ctx.app.reloadService.onUpdateSouthSettings(ctx.params.id, command);
        ctx.noContent();
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteSouthConnector(ctx: KoaContext<void, void>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
    if (southConnector) {
      await ctx.app.reloadService.onDeleteSouth(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async searchSouthItems(ctx: KoaContext<void, Page<OibusItemDTO>>): Promise<void> {
    const searchParams: OibusItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: (ctx.query.name as string) || null
    };
    const southItems = ctx.app.repositoryService.southItemRepository.searchSouthItems(ctx.params.southId, searchParams);
    ctx.ok(southItems);
  }

  async getSouthItem(ctx: KoaContext<void, OibusItemDTO>): Promise<void> {
    const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
    if (southItem) {
      ctx.ok(southItem);
    } else {
      ctx.notFound();
    }
  }

  async createSouthItem(ctx: KoaContext<OibusItemCommandDTO, OibusItemDTO>): Promise<void> {
    try {
      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
      if (!southConnector) {
        return ctx.throw(404, 'South not found');
      }

      const manifest = southManifests.find(south => south.name === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const command: OibusItemCommandDTO | undefined = ctx.request.body;
      if (command) {
        await this.validator.validate(manifest.items.schema, command?.settings);

        const southItem = await ctx.app.reloadService.onCreateSouthItem(ctx.params.southId, command);
        ctx.created(southItem);
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthItem(ctx: KoaContext<OibusItemCommandDTO, void>): Promise<void> {
    try {
      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
      if (!southConnector) {
        return ctx.throw(404, 'South not found');
      }

      const manifest = southManifests.find(south => south.name === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
      if (southItem) {
        const command: OibusItemCommandDTO | undefined = ctx.request.body;
        if (command) {
          await this.validator.validate(manifest.items.schema, command?.settings);

          await ctx.app.reloadService.onUpdateSouthItemsSettings(ctx.params.southId, southItem, command);
          ctx.noContent();
        } else {
          ctx.badRequest();
        }
      } else {
        ctx.notFound();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onDeleteSouthItem(ctx.params.id);
    ctx.noContent();
  }
}
