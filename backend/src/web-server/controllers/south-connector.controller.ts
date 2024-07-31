import { KoaContext } from '../koa';
import csv from 'papaparse';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorWithItemsCommandDTO,
  SouthType,
  SouthConnectorItemScanModeNameDTO,
  SouthConnectorItemTestCommandDTO
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import JoiValidator from './validators/joi.validator';
import fs from 'node:fs/promises';
import { OIBusContent } from '../../../../shared/model/engine.model';

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

  async findAll(ctx: KoaContext<void, Array<SouthConnectorDTO>>): Promise<void> {
    const southConnectors = ctx.app.repositoryService.southConnectorRepository.findAll();
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

  async findById(ctx: KoaContext<void, SouthConnectorDTO>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.params.id);
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
        southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.params.id);
        if (!southConnector) {
          return ctx.notFound();
        }
      }
      if (!southConnector && ctx.query.duplicateId) {
        southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.query.duplicateId);
        if (!southConnector) {
          return ctx.notFound();
        }
      }
      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);

      const command: SouthConnectorDTO = { id: southConnector?.id || 'test', ...ctx.request.body! };
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        southConnector?.settings,
        manifest.settings
      );
      ctx.request.body!.name = southConnector ? southConnector.name : `${ctx.request.body!.type}:test-connection`;
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: command.id,
          scopeName: command.name
        },
        { level: 'silent' }
      );
      const southToTest = ctx.app.southService.createSouth(command, this.addContent, 'baseFolder', logger);
      await southToTest.testConnection();

      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async create(ctx: KoaContext<SouthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.items || !ctx.request.body.south) {
      return ctx.badRequest();
    }

    try {
      const command = ctx.request.body!;
      const created: SouthConnectorDTO = await ctx.app.southConnectorConfigService.create(command);
      ctx.created(created);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async update(ctx: KoaContext<SouthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.items || !ctx.request.body.south) {
      return ctx.badRequest();
    }

    try {
      await ctx.app.southConnectorConfigService.update(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.delete(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async start(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.start(ctx.params.id!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async stop(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.stop(ctx.params.id!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async resetSouthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.params.southId);
    if (southConnector) {
      ctx.app.reloadService.oibusEngine.resetSouthMetrics(ctx.params.southId);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async testSouthItem(ctx: KoaContext<SouthConnectorItemTestCommandDTO, void>): Promise<void> {
    try {
      // South validation
      const manifest = ctx.request.body
        ? ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.request.body!.south.type)
        : null;
      if (!manifest) {
        return ctx.notFound('South manifest not found');
      }

      let southConnector: SouthConnectorDTO | null = null;
      if (ctx.params.id !== 'create') {
        southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.params.id);
        if (!southConnector) {
          return ctx.notFound(`South not found: ${ctx.params.id}`);
        }
      }
      if (!southConnector && ctx.query.duplicateId) {
        southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.query.duplicateId);
        if (!southConnector) {
          return ctx.notFound(`South not found: ${ctx.query.duplicateId}`);
        }
      }
      await this.validator.validateSettings(manifest.settings, ctx.request.body!.south.settings);

      // South item validation
      const itemCommand = ctx.request.body!.item;
      if (!itemCommand.scanModeId && !itemCommand.scanModeName) {
        return ctx.badRequest(`Scan mode not specified for item ${itemCommand.name}`);
      }

      let scanModeId = itemCommand.scanModeId;
      if (!itemCommand.scanModeId && itemCommand.scanModeName) {
        const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();
        const scanMode = scanModes.find(element => element.name === itemCommand.scanModeName);
        if (!scanMode) {
          return ctx.badRequest(`Scan mode ${itemCommand.scanModeName} not found for item ${itemCommand.name}`);
        }
        scanModeId = scanMode.id;
      }
      await this.validator.validateSettings(manifest.items.settings, ctx.request.body!.item.settings);

      // Prepare South and South item to test
      const southCommand: SouthConnectorDTO = { id: southConnector?.id || 'test', ...ctx.request.body!.south };
      southCommand.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        southCommand.settings,
        southConnector?.settings,
        manifest.settings
      );
      ctx.request.body!.south.name = southConnector ? southConnector.name : `${ctx.request.body!.south.type}:test-connection`;
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: southCommand.id,
          scopeName: southCommand.name
        },
        { level: 'silent' }
      );
      const southToTest = ctx.app.southService.createSouth(southCommand, this.addContent, 'baseFolder', logger);

      const southItemToTest: SouthConnectorItemDTO = {
        id: 'test',
        connectorId: southCommand.id,
        scanModeId: scanModeId!,
        ...ctx.request.body!.item
      };

      await southToTest.testItem(southItemToTest, ctx.ok);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async listSouthItems(ctx: KoaContext<void, Array<SouthConnectorItemDTO>>): Promise<void> {
    const southItems = ctx.app.repositoryService.southItemRepository.list(ctx.params.southId, {});
    ctx.ok(southItems);
  }

  async searchSouthItems(ctx: KoaContext<void, Page<SouthConnectorItemDTO>>): Promise<void> {
    const searchParams: SouthConnectorItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const southItems = ctx.app.repositoryService.southItemRepository.search(ctx.params.southId, searchParams);
    ctx.ok(southItems);
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a connector (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async southItemsToCsv(ctx: KoaContext<{ items: Array<SouthConnectorItemDTO>; delimiter: string }, any>): Promise<void> {
    const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();
    const southItems = ctx.request.body!.items.map(item => {
      const flattenedItem: Record<string, any> = {
        ...item
      };

      flattenedItem.scanMode = scanModes.find(scanMode => scanMode.id === flattenedItem.scanModeId)?.name ?? '';
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        if (typeof itemSettingsValue === 'object') {
          flattenedItem[`settings_${itemSettingsKey}`] = JSON.stringify(itemSettingsValue);
        } else {
          flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue;
        }
      }
      delete flattenedItem.id;
      delete flattenedItem.scanModeId;
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    });
    ctx.body = csv.unparse(southItems, { delimiter: ctx.request.body!.delimiter });
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportSouthItems(ctx: KoaContext<{ delimiter: string }, any>): Promise<void> {
    const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();
    const columns: Set<string> = new Set<string>(['name', 'enabled', 'scanMode']);
    const southItems = ctx.app.repositoryService.southItemRepository.findAllForSouthConnector(ctx.params.southId).map(item => {
      const flattenedItem: Record<string, any> = {
        ...item
      };
      flattenedItem.scanMode = scanModes.find(scanMode => scanMode.id === flattenedItem.scanModeId)?.name ?? '';
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        columns.add(`settings_${itemSettingsKey}`);
        if (typeof itemSettingsValue === 'object') {
          flattenedItem[`settings_${itemSettingsKey}`] = JSON.stringify(itemSettingsValue);
        } else {
          flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue;
        }
      }
      delete flattenedItem.id;
      delete flattenedItem.scanModeId;
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    });
    ctx.body = csv.unparse(southItems, { columns: Array.from(columns), delimiter: ctx.request.body!.delimiter });
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async checkImportSouthItems(ctx: KoaContext<{ itemIdsToDelete: string; delimiter: string }, any>): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.southType);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const file = ctx.request.file;
    const delimiter = ctx.request.body!.delimiter;

    let itemIdsToDelete: Array<string>;
    try {
      itemIdsToDelete = JSON.parse(ctx.request.body!.itemIdsToDelete);
    } catch {
      return ctx.throw(400, 'Could not parse item ids to delete array');
    }

    const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();

    const existingItems: Array<SouthConnectorItemDTO> =
      ctx.params.southId === 'create'
        ? []
        : ctx.app.repositoryService.southItemRepository
            .findAllForSouthConnector(ctx.params.southId)
            .filter(item => !itemIdsToDelete.includes(item.id));
    const validItems: Array<any> = [];
    const errors: Array<any> = [];
    try {
      let isError = false;
      const fileContent = await fs.readFile(file.path);
      let csvContent = csv.parse(fileContent.toString('utf8'), { header: true });

      if (csvContent.errors[0]?.code === 'UndetectableDelimiter') {
        const csvContent2 = csv.parse(fileContent.toString('utf8'), { header: true, delimiter: delimiter });
        isError = JSON.stringify(csvContent2.data) === JSON.stringify(csvContent.data); // if it's true it means that csvContent2 don't succeed to have the good data with the good delimiter, so it's an error
        csvContent = csvContent2;
      }

      for (const error of csvContent.errors) {
        throw new Error(error.message);
      }

      if (csvContent.meta.delimiter !== delimiter || isError) {
        throw new Error(`The entered delimiter does not correspond to the file delimiter`);
      }

      for (const data of csvContent.data) {
        const item: SouthConnectorItemDTO = {
          id: '',
          name: (data as any).name,
          enabled: (data as any).enabled.toLowerCase() === 'true',
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

              if ((manifestSettings.type === 'OibArray' || manifestSettings.type === 'OibFormGroup') && value) {
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

  async importSouthItems(ctx: KoaContext<{ items: Array<SouthConnectorItemScanModeNameDTO> }, any>): Promise<void> {
    const southConnector = ctx.app.repositoryService.southConnectorRepository.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.throw(404, 'South not found');
    }

    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const items = ctx.request.body!.items;
    try {
      const scanModes = ctx.app.repositoryService.scanModeRepository.findAll();

      // Check if item settings match the item schema, throw an error otherwise
      for (const item of items) {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
        if (!item.scanModeId && !item.scanModeName) {
          throw new Error(`Scan mode not specified for item ${item.name}`);
        } else if (!item.scanModeId && item.scanModeName) {
          const scanMode = scanModes.find(element => element.name === item.scanModeName);
          if (!scanMode) {
            throw new Error(`Scan mode ${item.scanModeName} not found for item ${item.name}`);
          }
          item.scanModeId = scanMode.id;
          delete item.scanModeName;
        }
      }
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }

    try {
      ctx.app.reloadService.onCreateOrUpdateSouthItems(southConnector, items, []);
      await ctx.app.reloadService.oibusEngine.onSouthItemsChange(southConnector.id);
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
    ctx.noContent();
  }

  async getSouthItem(ctx: KoaContext<void, SouthConnectorItemDTO>): Promise<void> {
    const southItem = ctx.app.repositoryService.southItemRepository.findById(ctx.params.id);
    if (southItem) {
      ctx.ok(southItem);
    } else {
      ctx.notFound();
    }
  }

  async createSouthItem(ctx: KoaContext<SouthConnectorItemCommandDTO, SouthConnectorItemDTO>): Promise<void> {
    if (!ctx.request.body || !ctx.params.southId) {
      return ctx.badRequest();
    }
    try {
      const item = await ctx.app.southConnectorConfigService.createItem(ctx.params.southId!, ctx.request.body!);
      ctx.created(item);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateSouthItem(ctx: KoaContext<SouthConnectorItemCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.params.southId || !ctx.params.id) {
      return ctx.badRequest();
    }
    try {
      await ctx.app.southConnectorConfigService.updateItem(ctx.params.southId!, ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.deleteItem(ctx.params.southId, ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async enableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.enableItem(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async disableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.disableItem(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteAllSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southConnectorConfigService.deleteAllItems(ctx.params.southId);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async addContent(_southId: string, _content: OIBusContent): Promise<void> {}
}
