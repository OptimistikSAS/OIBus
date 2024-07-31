import { KoaContext } from '../koa';
import csv from 'papaparse';
import {
  NorthCacheSettingsDTO,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorItemCommandDTO,
  NorthConnectorItemDTO,
  NorthConnectorItemSearchParam,
  NorthConnectorManifest,
  NorthConnectorWithItemsCommandDTO,
  NorthType
} from '../../../../shared/model/north-connector.model';
import JoiValidator from './validators/joi.validator';
import { Page } from '../../../../shared/model/types';
import fs from 'node:fs/promises';
import { TransformerDTO, TransformerFilterDTO } from '../../../../shared/model/transformer.model';

export default class NorthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getNorthConnectorTypes(ctx: KoaContext<void, Array<NorthType>>): Promise<void> {
    ctx.ok(
      ctx.app.northService.getInstalledNorthManifests().map(manifest => ({
        id: manifest.id,
        category: manifest.category,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  }

  async getNorthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'North not found');
    }
    ctx.ok(manifest);
  }

  async findAll(ctx: KoaContext<void, Array<NorthConnectorDTO>>): Promise<void> {
    const northConnectors = ctx.app.repositoryService.northConnectorRepository.findAll();
    ctx.ok(
      northConnectors.map(connector => {
        const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === connector.type);
        if (manifest) {
          connector.settings = ctx.app.encryptionService.filterSecrets(connector.settings, manifest.settings);
          return connector;
        }
        return null;
      })
    );
  }

  async findById(ctx: KoaContext<void, NorthConnectorDTO>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.id);
    if (northConnector) {
      const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === northConnector.type);
      if (manifest) {
        northConnector.settings = ctx.app.encryptionService.filterSecrets(northConnector.settings, manifest.settings);
        ctx.ok(northConnector);
      } else {
        ctx.throw(404, 'North type not found');
      }
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<NorthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.north) {
      return ctx.badRequest();
    }

    try {
      const command = ctx.request.body!.north;
      const northConnector = await ctx.app.northConnectorConfigService.create(command);
      ctx.created(northConnector);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async update(ctx: KoaContext<NorthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.north) {
      return ctx.badRequest();
    }

    try {
      const command = ctx.request.body!.north;
      await ctx.app.northConnectorConfigService.update(ctx.params.id!, command);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northConnectorConfigService.delete(ctx.params.id!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  start = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.northConnectorConfigService.start(ctx.params.id!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  stop = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.northConnectorConfigService.stop(ctx.params.id!);
      ctx.noContent();
    } catch {
      ctx.badRequest();
    }
  };

  async resetMetrics(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (northConnector) {
      await ctx.app.reloadService.oibusEngine.resetNorthMetrics(ctx.params.northId);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async getFileErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getErrorFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getFileErrorContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.attachment(ctx.params.filename);
    const fileStream = await ctx.app.reloadService.oibusEngine.getErrorFileContent(northConnector.id, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.ok(fileStream);
  }

  async removeFileErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.removeErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryErrorFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.retryErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.retryAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getCacheFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getCacheFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.attachment(ctx.params.filename);
    const fileStream = await ctx.app.reloadService.oibusEngine.getCacheFileContent(northConnector.id, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.ok(fileStream);
  }

  async removeCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.removeCacheFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async archiveCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.archiveCacheFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async getArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getArchiveFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getArchiveFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.attachment(ctx.params.filename);
    const fileStream = await ctx.app.reloadService.oibusEngine.getArchiveFileContent(northConnector.id, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.ok(fileStream);
  }

  async removeArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.removeArchiveFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.retryArchiveFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.retryAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const cacheValues = await ctx.app.reloadService.oibusEngine.getCacheValues(northConnector.id, fileNameContains);
    ctx.ok(cacheValues);
  }

  async removeCacheValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.removeCacheValues(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllCacheValues(northConnector.id);
    ctx.noContent();
  }

  async getValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getValueErrors(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async removeValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.removeValueErrors(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllValueErrors(northConnector.id);
    ctx.noContent();
  }

  async retryValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.oibusEngine.retryValueErrors(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryAllValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.retryAllValueErrors(northConnector.id);
    ctx.noContent();
  }

  async testNorthConnection(ctx: KoaContext<NorthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = ctx.request.body
        ? ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === ctx.request.body!.type)
        : null;
      if (!manifest) {
        return ctx.throw(404, 'North manifest not found');
      }
      let northConnector: NorthConnectorDTO | null = null;
      if (ctx.params.id !== 'create') {
        northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.id);
        if (!northConnector) {
          return ctx.notFound();
        }
      }
      if (!northConnector && ctx.query.duplicateId) {
        northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.query.duplicateId);
        if (!northConnector) {
          return ctx.notFound();
        }
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);
      const northCaching = { ...ctx.request.body!.caching };
      delete northCaching.scanModeName;
      northCaching.scanModeId = '';
      const command: NorthConnectorDTO = {
        id: northConnector?.id || 'test',
        ...ctx.request.body!,
        caching: northCaching as NorthCacheSettingsDTO,
        name: northConnector?.name || `${ctx.request.body!.type}:test-connection`
      };
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        northConnector?.settings,
        manifest.settings
      );
      const logger = ctx.app.logger.child(
        {
          scopeType: 'north',
          scopeId: command.id,
          scopeName: command.name
        },
        { level: 'silent' }
      );
      const northToTest = ctx.app.northService.createNorth(command, 'baseFolder', logger);
      await northToTest.testConnection();

      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async listNorthItems(ctx: KoaContext<void, Array<NorthConnectorItemDTO>>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    const northItems = ctx.app.repositoryService.northItemRepository.list(ctx.params.northId, {});
    ctx.ok(northItems);
  }

  async searchNorthItems(ctx: KoaContext<void, Page<NorthConnectorItemDTO>>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    const searchParams: NorthConnectorItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name
    };
    const northItems = ctx.app.repositoryService.northItemRepository.search(ctx.params.northId, searchParams);
    ctx.ok(northItems);
  }

  async northItemsToCsv(ctx: KoaContext<{ items: Array<NorthConnectorItemDTO> }, any>): Promise<void> {
    this.getManifestWithItemsMode(ctx);

    const northItems = ctx.request.body!.items.map(item => {
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
      delete flattenedItem.id;
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    });
    ctx.body = csv.unparse(northItems);
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportNorthItems(ctx: KoaContext<any, any>): Promise<void> {
    this.getManifestWithItemsMode(ctx);

    const northItems = ctx.app.repositoryService.northItemRepository.findAllForNorthConnector(ctx.params.northId).map(item => {
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
      delete flattenedItem.id;
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    });
    ctx.body = csv.unparse(northItems);
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async checkImportNorthItems(ctx: KoaContext<{ itemIdsToDelete: string }, any>): Promise<void> {
    const manifest = this.getManifestWithItemsMode(ctx);

    const file = ctx.request.file;

    let itemIdsToDelete: Array<string>;
    try {
      itemIdsToDelete = JSON.parse(ctx.request.body!.itemIdsToDelete);
    } catch {
      return ctx.throw(400, 'Could not parse item ids to delete array');
    }

    const existingItems: Array<NorthConnectorItemDTO> =
      ctx.params.northId === 'create'
        ? []
        : ctx.app.repositoryService.northItemRepository
            .findAllForNorthConnector(ctx.params.northId)
            .filter(item => !itemIdsToDelete.includes(item.id));
    const validItems: Array<any> = [];
    const errors: Array<any> = [];
    try {
      const fileContent = await fs.readFile(file.path);
      const csvContent = csv.parse(fileContent.toString('utf8'), { header: true });

      for (const data of csvContent.data) {
        const item: NorthConnectorItemDTO = {
          id: '',
          name: (data as any).name,
          enabled: true,
          connectorId: ctx.params.northId !== 'create' ? ctx.params.northId : '',
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

  async importNorthItems(ctx: KoaContext<{ items: Array<NorthConnectorItemDTO> }, any>): Promise<void> {
    const manifest = this.getManifestWithItemsMode(ctx);
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.throw(404, 'North not found');
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
      const itemsToAdd = items.filter(item => !item.id);
      const itemsToUpdate = items.filter(item => item.id);

      ctx.app.reloadService.onCreateOrUpdateNorthItems(northConnector, itemsToAdd, itemsToUpdate);
      await ctx.app.reloadService.oibusEngine.onNorthItemsChange(northConnector.id);
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
    ctx.noContent();
  }

  async getNorthItem(ctx: KoaContext<void, NorthConnectorItemDTO>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    const northItem = ctx.app.repositoryService.northItemRepository.findById(ctx.params.id);
    if (northItem) {
      ctx.ok(northItem);
    } else {
      ctx.notFound();
    }
  }

  async createNorthItem(ctx: KoaContext<NorthConnectorItemCommandDTO, NorthConnectorItemDTO>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.settings) {
      return ctx.badRequest();
    }

    try {
      const manifest = this.getManifestWithItemsMode(ctx);

      await this.validator.validateSettings(manifest.items.settings, ctx.request.body.settings);

      const command: NorthConnectorItemCommandDTO = ctx.request.body!;
      const northItem = await ctx.app.reloadService.onCreateNorthItem(ctx.params.northId, command);
      ctx.created(northItem);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateNorthItem(ctx: KoaContext<NorthConnectorItemCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.settings) {
      return ctx.badRequest();
    }

    try {
      const manifest = this.getManifestWithItemsMode(ctx);

      const northItem = ctx.app.repositoryService.northItemRepository.findById(ctx.params.id);
      if (northItem) {
        await this.validator.validateSettings(manifest.items.settings, ctx.request.body.settings);
        const command: NorthConnectorItemCommandDTO = ctx.request.body!;
        await ctx.app.reloadService.onUpdateNorthItemSettings(ctx.params.northId, northItem, command);
        ctx.noContent();
      } else {
        ctx.notFound();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    await ctx.app.reloadService.onDeleteNorthItem(ctx.params.id);
    await ctx.app.reloadService.oibusEngine.onNorthItemsChange(ctx.params.northId);

    ctx.noContent();
  }

  async enableNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    await ctx.app.reloadService.onEnableNorthItem(ctx.params.id);
    ctx.noContent();
  }

  async disableNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    await ctx.app.reloadService.onDisableNorthItem(ctx.params.id);
    ctx.noContent();
  }

  async deleteAllNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    this.getManifestWithItemsMode(ctx);
    await ctx.app.reloadService.onDeleteAllNorthItems(ctx.params.northId);
    ctx.noContent();
  }

  async addTransformer(ctx: KoaContext<void, void>): Promise<void> {
    try {
      const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
      if (!northConnector) {
        return ctx.throw(404, 'North not found');
      }

      const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.transformerId);
      if (!transformer) {
        return ctx.throw(404, 'Transformer not found');
      }

      ctx.app.repositoryService.northTransformerRepository.addTransformer(ctx.params.northId, ctx.params.transformerId);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async getTransformers(ctx: KoaContext<void, Array<TransformerDTO>>): Promise<void> {
    try {
      const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
      if (!northConnector) {
        return ctx.throw(404, 'North not found');
      }

      const filter: TransformerFilterDTO = {
        inputType: ctx.query.inputType as string,
        outputType: ctx.query.outputType as string,
        name: ctx.query.name as string
      };

      const transformers = ctx.app.repositoryService.northTransformerRepository.getTransformers(ctx.params.northId, filter);
      ctx.ok(transformers);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async removeTransformer(ctx: KoaContext<void, void>): Promise<void> {
    try {
      const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
      if (!northConnector) {
        return ctx.throw(404, 'North not found');
      }

      const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.transformerId);
      if (!transformer) {
        return ctx.throw(404, 'Transformer not found');
      }

      ctx.app.repositoryService.northTransformerRepository.removeTransformer(ctx.params.northId, ctx.params.transformerId);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  /**
   * Checks if the north connector exists and if it supports items mode.
   * If both are true it returns the manifest, otherwise throws koa errors.
   *
   * @throws koa errors
   */
  private getManifestWithItemsMode(ctx: KoaContext<any, any>): NorthConnectorManifest<true> {
    let northType: string;
    if (ctx.params.northId === 'create') {
      northType = ctx.params.northType;
    } else {
      const northConnector = ctx.app.repositoryService.northConnectorRepository.findById(ctx.params.northId);
      if (!northConnector) {
        return ctx.throw(404, 'North not found');
      }
      northType = northConnector.type;
    }

    const manifest = ctx.app.northService
      .getInstalledNorthManifests()
      .find(northManifest => northManifest.id === northType && northManifest.modes.items) as NorthConnectorManifest<true> | undefined;

    if (!manifest) {
      return ctx.throw(404, 'North does not support items');
    }

    return manifest;
  }
}
