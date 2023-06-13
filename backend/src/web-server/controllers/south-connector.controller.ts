import { KoaContext } from '../koa';
import csv from 'papaparse';

import adsManifest from '../../south/south-ads/manifest';
import folderScannerManifest from '../../south/south-folder-scanner/manifest';
import modbusManifest from '../../south/south-modbus/manifest';
import mqttManifest from '../../south/south-mqtt/manifest';
import opchdaManifest from '../../south/south-opchda/manifest';
import opcuaDaManifest from '../../south/south-opcua-da/manifest';
import opcuaHaManifest from '../../south/south-opcua-ha/manifest';
import oiconnectManifest from '../../south/south-oiconnect/manifest';
import mssqlManifest from '../../south/south-mssql/manifest';
import mysqlManifest from '../../south/south-mysql/manifest';
import postgresqlManifest from '../../south/south-postgresql/manifest';
import oracleManifest from '../../south/south-oracle/manifest';
import odbcManifest from '../../south/south-odbc/manifest';
import sqliteManifest from '../../south/south-sqlite/manifest';
import {
  OibusItemCommandDTO,
  OibusItemDTO,
  OibusItemSearchParam,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import JoiValidator from '../../validators/joi.validator';
import fs from 'node:fs/promises';

// TODO: retrieve south types from a local store
export const southManifests = [
  oiconnectManifest,
  opcuaHaManifest,
  opcuaDaManifest,
  opchdaManifest,
  mqttManifest,
  modbusManifest,
  folderScannerManifest,
  adsManifest,
  mssqlManifest,
  mysqlManifest,
  postgresqlManifest,
  oracleManifest,
  odbcManifest,
  sqliteManifest
];

export default class SouthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getSouthConnectorTypes(ctx: KoaContext<void, Array<SouthType>>): Promise<void> {
    ctx.ok(
      southManifests.map(manifest => ({
        category: manifest.category,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  }

  async getSouthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = southManifests.find(southManifest => southManifest.id === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'South not found');
    }
    ctx.ok(manifest);
  }

  async getSouthConnectors(ctx: KoaContext<void, Array<SouthConnectorDTO>>): Promise<void> {
    const southConnectors = ctx.app.repositoryService.southConnectorRepository.getSouthConnectors();
    ctx.ok(
      southConnectors.map(connector => {
        const manifest = southManifests.find(southManifest => southManifest.id === connector.type);
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
      const manifest = southManifests.find(southManifest => southManifest.id === southConnector.type);
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

  async testSouthConnection(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = ctx.request.body ? southManifests.find(southManifest => southManifest.id === ctx.request.body!.type) : null;
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);

      const command: SouthConnectorCommandDTO = ctx.request.body!;
      // TODO: replace with existing secrets if existing
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);
      ctx.request.body!.name = `${ctx.request.body!.type}:test-connection`; // TODO: replace with existing name if existing
      await ctx.app.reloadService.oibusEngine.testSouth(command);

      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async createSouthConnector(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = ctx.request.body ? southManifests.find(southManifest => southManifest.id === ctx.request.body!.type) : null;
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);

      const command: SouthConnectorCommandDTO = ctx.request.body!;
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);
      const southConnector = await ctx.app.reloadService.onCreateSouth(command);
      ctx.created(southConnector);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthConnector(ctx: KoaContext<SouthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = ctx.request.body ? southManifests.find(southManifest => southManifest.id === ctx.request.body!.type) : null;
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);

      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
      if (!southConnector) {
        return ctx.notFound();
      }

      const command: SouthConnectorCommandDTO = ctx.request.body!;
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        southConnector.settings,
        manifest.settings
      );
      await ctx.app.reloadService.onUpdateSouthSettings(ctx.params.id, command);
      ctx.noContent();
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

  async resetSouthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (southConnector) {
      await ctx.app.reloadService.oibusEngine.resetSouthMetrics(ctx.params.southId);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async listSouthItems(ctx: KoaContext<void, Array<OibusItemDTO>>): Promise<void> {
    const southItems = ctx.app.repositoryService.southItemRepository.listSouthItems(ctx.params.southId);
    ctx.ok(southItems);
  }

  async searchSouthItems(ctx: KoaContext<void, Page<OibusItemDTO>>): Promise<void> {
    const searchParams: OibusItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: (ctx.query.name as string) || null
    };
    const southItems = ctx.app.repositoryService.southItemRepository.searchSouthItems(ctx.params.southId, searchParams);
    ctx.ok(southItems);
  }

  async exportSouthItems(ctx: KoaContext<void, any>): Promise<void> {
    const southItems = ctx.app.repositoryService.southItemRepository.getSouthItems(ctx.params.southId).map(item => {
      const flattenedItem: Record<string, any> = {
        ...item
      };
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue;
      }
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    });
    ctx.body = csv.unparse(southItems);
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async uploadSouthItems(ctx: KoaContext<void, any>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.throw(404, 'South not found');
    }

    const manifest = southManifests.find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const file = ctx.request.file;
    if (file.mimetype !== 'text/csv') {
      return ctx.badRequest();
    }
    let items: Array<any> = [];
    try {
      const fileContent = await fs.readFile(file.path);
      const csvContent = csv.parse(fileContent.toString('utf8'), { header: true });
      items = csvContent.data.map((data: any) => {
        const item: Record<string, any> = { settings: {} };
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('settings_')) {
            item.settings[key.replace('settings_', '')] = value;
          } else {
            item[key] = value;
          }
        }
        return item;
      });
      // Check if item settings match the item schema, throw an error otherwise
      for (const item of items) {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
      }
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }

    try {
      const itemsToAdd = items.filter(item => !item.id);
      const itemsToUpdate = items.filter(item => item.id);

      await ctx.app.reloadService.onCreateOrUpdateSouthItems(southConnector, itemsToAdd, itemsToUpdate);
    } catch {
      return ctx.badRequest();
    }

    ctx.noContent();
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

      const manifest = southManifests.find(southManifest => southManifest.id === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.items.settings, ctx.request.body?.settings);

      const command: OibusItemCommandDTO = ctx.request.body!;
      const southItem = await ctx.app.reloadService.onCreateSouthItem(ctx.params.southId, command);
      ctx.created(southItem);
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

      const manifest = southManifests.find(southManifest => southManifest.id === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
      if (southItem) {
        await this.validator.validateSettings(manifest.items.settings, ctx.request.body?.settings);
        const command: OibusItemCommandDTO = ctx.request.body!;
        await ctx.app.reloadService.onUpdateSouthItemsSettings(ctx.params.southId, southItem, command);
        ctx.noContent();
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

  async deleteAllSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onDeleteAllSouthItems(ctx.params.southId);
    ctx.noContent();
  }
}
