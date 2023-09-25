import { KoaContext } from '../koa';
import csv from 'papaparse';
import {
  SouthConnectorCommandDTO,
  SouthConnectorWithItemsCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import JoiValidator from './validators/joi.validator';
import fs from 'node:fs/promises';

export default class SouthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getSouthConnectorTypes(ctx: KoaContext<void, Array<SouthType>>): Promise<void> {
    ctx.ok(
      ctx.app.southService.getInstalledSouthManifests().map(manifest => ({
        category: manifest.category,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  }

  async getSouthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'South not found');
    }
    ctx.ok(manifest);
  }

  async getSouthConnectors(ctx: KoaContext<void, Array<SouthConnectorDTO>>): Promise<void> {
    const southConnectors = ctx.app.repositoryService.southConnectorRepository.getSouthConnectors();
    ctx.ok(
      southConnectors.map(connector => {
        const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === connector.type);
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
      const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
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
      const manifest = ctx.request.body
        ? ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.request.body!.type)
        : null;
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }
      let southConnector: SouthConnectorDTO | null = null;
      if (ctx.params.id !== 'create') {
        southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
        if (!southConnector) {
          return ctx.notFound();
        }
      }
      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);

      const command: SouthConnectorDTO = { id: southConnector?.id || 'test', ...ctx.request.body! };
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        southConnector?.settings || null,
        manifest.settings
      );
      ctx.request.body!.name = southConnector ? southConnector.name : `${ctx.request.body!.type}:test-connection`;
      const southToTest = ctx.app.southService.createSouth(command, [], this.addValues, this.addFile, 'baseFolder', ctx.app.logger);
      await southToTest.testConnection();

      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async createSouthConnector(ctx: KoaContext<SouthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.items || !ctx.request.body.south) {
      return ctx.badRequest();
    }

    try {
      const command = ctx.request.body!.south;
      const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);

      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, command.settings);
      // Check if item settings match the item schema, throw an error otherwise
      for (const item of ctx.request.body!.items) {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
      }

      if (manifest.modes.forceMaxInstantPerItem) {
        command.history.maxInstantPerItem = true;
      }
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);
      const southConnector = await ctx.app.reloadService.onCreateSouth(command);
      await ctx.app.reloadService.onCreateOrUpdateSouthItems(southConnector, ctx.request.body!.items, []);

      ctx.created(southConnector);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthConnector(ctx: KoaContext<SouthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.items || !ctx.request.body.south) {
      return ctx.badRequest();
    }

    const command = ctx.request.body!.south;
    try {
      const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);

      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, command!.settings);
      // Check if item settings match the item schema, throw an error otherwise
      for (const item of ctx.request.body!.items) {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
      }

      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
      if (!southConnector) {
        return ctx.notFound();
      }

      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        southConnector.settings,
        manifest.settings
      );

      const itemsToAdd = ctx.request.body!.items.filter(item => !item.id);
      const itemsToUpdate = ctx.request.body!.items.filter(item => item.id);
      for (const itemId of ctx.request.body!.itemIdsToDelete) {
        await ctx.app.reloadService.onDeleteSouthItem(itemId);
      }
      await ctx.app.reloadService.onCreateOrUpdateSouthItems(southConnector, itemsToAdd, itemsToUpdate);
      await ctx.app.reloadService.onUpdateSouth(ctx.params.id, command);
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

  startSouthConnector = async (ctx: KoaContext<void, void>) => {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
    if (!southConnector) {
      return ctx.notFound();
    }

    try {
      await ctx.app.reloadService.onStartSouth(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  stopSouthConnector = async (ctx: KoaContext<void, void>) => {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.id);
    if (!southConnector) {
      return ctx.notFound();
    }

    try {
      await ctx.app.reloadService.onStopSouth(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  async resetSouthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (southConnector) {
      await ctx.app.reloadService.oibusEngine.resetSouthMetrics(ctx.params.southId);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async listSouthItems(ctx: KoaContext<void, Array<SouthConnectorItemDTO>>): Promise<void> {
    const southItems = ctx.app.repositoryService.southItemRepository.listSouthItems(ctx.params.southId);
    ctx.ok(southItems);
  }

  async searchSouthItems(ctx: KoaContext<void, Page<SouthConnectorItemDTO>>): Promise<void> {
    const searchParams: SouthConnectorItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: (ctx.query.name as string) || null
    };
    const southItems = ctx.app.repositoryService.southItemRepository.searchSouthItems(ctx.params.southId, searchParams);
    ctx.ok(southItems);
  }

  async southItemsToCsv(ctx: KoaContext<{ items: Array<SouthConnectorItemDTO> }, any>): Promise<void> {
    const southItems = ctx.request.body!.items.map(item => {
      const flattenedItem: Record<string, any> = {
        ...item
      };
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        if (typeof itemSettingsValue === 'object') {
          flattenedItem[`settings_${itemSettingsKey}`] = JSON.stringify(itemSettingsValue);
        } else {
          flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue;
        }
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

  async exportSouthItems(ctx: KoaContext<void, any>): Promise<void> {
    const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();
    const southItems = ctx.app.repositoryService.southItemRepository.getSouthItems(ctx.params.southId).map(item => {
      const flattenedItem: Record<string, any> = {
        ...item
      };
      delete flattenedItem.id;
      flattenedItem.scanMode = scanModes.find(scanMode => scanMode.id === flattenedItem.scanModeId)?.name ?? '';
      delete flattenedItem.scanModeId;
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        if (typeof itemSettingsValue === 'object') {
          flattenedItem[`settings_${itemSettingsKey}`] = JSON.stringify(itemSettingsValue);
        } else {
          flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue;
        }
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

  async checkImportSouthItems(ctx: KoaContext<void, any>): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.southType);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const file = ctx.request.file;
    if (file.mimetype !== 'text/csv') {
      return ctx.badRequest();
    }
    const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();

    const existingItems: Array<SouthConnectorItemDTO> =
      ctx.params.southId === 'create' ? [] : ctx.app.repositoryService.southItemRepository.getSouthItems(ctx.params.southId);
    const validItems: Array<any> = [];
    const errors: Array<any> = [];
    try {
      const fileContent = await fs.readFile(file.path);
      const csvContent = csv.parse(fileContent.toString('utf8'), { header: true });

      for (const data of csvContent.data) {
        const item: SouthConnectorItemDTO = {
          id: '',
          name: (data as any).name,
          enabled: true,
          connectorId: ctx.params.southId !== 'create' ? ctx.params.southId : '',
          scanModeId: '',
          settings: {}
        };

        try {
          for (const [key, value] of Object.entries(data as any)) {
            if (key.startsWith('settings_')) {
              const settingsKey = key.replace('settings_', '');
              const manifestSettings = manifest.items.settings.find(settings => settings.key === settingsKey);
              if (!manifestSettings) {
                throw new Error(`Settings "${settingsKey}" not accepted in manifest`);
              }
              if (manifestSettings.type === 'OibArray' || manifestSettings.type === 'OibFormGroup') {
                item.settings[settingsKey] = JSON.parse(value as string);
              } else {
                item.settings[settingsKey] = value;
              }
            }
          }
        } catch (err: any) {
          errors.push({ item, message: err.message });
          continue;
        }

        if (existingItems.find(existingItem => existingItem.name === item.name)) {
          errors.push({ item, message: `Item name "${(data as any).name}" already used` });
          continue;
        }
        const foundScanMode = scanModes.find(scanMode => scanMode.name === (data as any).scanMode);
        if (!foundScanMode) {
          errors.push({ item, message: `Scan mode "${(data as any).scanMode}" not found for item ${item.name}` });
          continue;
        }
        item.scanModeId = foundScanMode.id;
        try {
          await this.validator.validateSettings(manifest.items.settings, item.settings);
          validItems.push(item);
        } catch (itemError: any) {
          errors.push({ item, message: itemError.message });
        }
      }
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }

    ctx.ok({ items: validItems, errors });
  }

  async importSouthItems(ctx: KoaContext<{ items: Array<SouthConnectorItemDTO> }, any>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.throw(404, 'South not found');
    }

    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const items = ctx.request.body!.items;
    try {
      // Check if item settings match the item schema, throw an error otherwise
      for (const item of items) {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
      }
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }

    try {
      await ctx.app.reloadService.onCreateOrUpdateSouthItems(southConnector, items, []);
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
    ctx.noContent();
  }

  async getSouthItem(ctx: KoaContext<void, SouthConnectorItemDTO>): Promise<void> {
    const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
    if (southItem) {
      ctx.ok(southItem);
    } else {
      ctx.notFound();
    }
  }

  async createSouthItem(ctx: KoaContext<SouthConnectorItemCommandDTO, SouthConnectorItemDTO>): Promise<void> {
    try {
      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
      if (!southConnector) {
        return ctx.throw(404, 'South not found');
      }

      const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      await this.validator.validateSettings(manifest.items.settings, ctx.request.body?.settings);

      const command: SouthConnectorItemCommandDTO = ctx.request.body!;
      const southItem = await ctx.app.reloadService.onCreateSouthItem(ctx.params.southId, command);
      ctx.created(southItem);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthItem(ctx: KoaContext<SouthConnectorItemCommandDTO, void>): Promise<void> {
    try {
      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
      if (!southConnector) {
        return ctx.throw(404, 'South not found');
      }

      const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const southItem = ctx.app.repositoryService.southItemRepository.getSouthItem(ctx.params.id);
      if (southItem) {
        await this.validator.validateSettings(manifest.items.settings, ctx.request.body?.settings);
        const command: SouthConnectorItemCommandDTO = ctx.request.body!;
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

  async enableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onEnableSouthItem(ctx.params.id);
    ctx.noContent();
  }

  async disableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onDisableSouthItem(ctx.params.id);
    ctx.noContent();
  }

  async deleteAllSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onDeleteAllSouthItems(ctx.params.southId);
    ctx.noContent();
  }

  async addValues(_southId: string, _values: Array<any>): Promise<void> {}

  async addFile(_southId: string, _filename: string): Promise<void> {}
}
