import { KoaContext } from '../koa';
import {
  NorthCacheFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorItemCommandDTO,
  NorthConnectorItemDTO,
  NorthConnectorItemSearchParam,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../shared/model/north-connector.model';
import JoiValidator from './validators/joi.validator';
import { toNorthConnectorDTO, toNorthConnectorItemDTO, toNorthConnectorLightDTO } from '../../service/north.service';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';
import { Page } from '../../../shared/model/types';
import { northItemToFlattenedCSV } from '../../service/utils';

export default class NorthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getNorthConnectorTypes(ctx: KoaContext<void, Array<NorthType>>): Promise<void> {
    ctx.ok(
      ctx.app.northService.getInstalledNorthManifests().map(manifest => ({
        id: manifest.id,
        category: manifest.category,
        modes: manifest.modes
      }))
    );
  }

  async getNorthConnectorManifest(ctx: KoaContext<void, NorthConnectorManifest>): Promise<void> {
    const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'North not found');
    }
    ctx.ok(manifest);
  }

  async findAll(ctx: KoaContext<void, Array<NorthConnectorLightDTO>>): Promise<void> {
    const northConnectors = ctx.app.northService.findAll();
    ctx.ok(northConnectors.map(connector => toNorthConnectorLightDTO(connector)));
  }

  async findById(ctx: KoaContext<void, NorthConnectorDTO<NorthSettings, NorthItemSettings>>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.id);
    if (northConnector) {
      ctx.ok(toNorthConnectorDTO(northConnector, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async create(
    ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>, NorthConnectorDTO<NorthSettings, NorthItemSettings>>
  ): Promise<void> {
    try {
      const northConnector = await ctx.app.northService.createNorth(ctx.request.body!, (ctx.query.duplicate as string) || null);
      ctx.created(toNorthConnectorDTO(northConnector, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateNorth(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.northService.updateNorth(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.deleteNorth(ctx.params.id!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  start = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.northService.startNorth(ctx.params.id!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  stop = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.northService.stopNorth(ctx.params.id!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  async resetNorthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.oIBusService.resetNorthConnectorMetrics(ctx.params.northId);
    ctx.noContent();
  }

  async getErrorFiles(ctx: KoaContext<void, Array<NorthCacheFiles>>): Promise<void> {
    const filenameContains = (ctx.query.filenameContains as string) || null;
    const startTime = (ctx.query.start as string) || null;
    const endTime = (ctx.query.end as string) || null;
    const errorFiles: Array<NorthCacheFiles> = await ctx.app.northService.getErrorFiles(
      ctx.params.northId,
      startTime,
      endTime,
      filenameContains
    );
    ctx.ok(errorFiles);
  }

  async getErrorFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const fileStream = await ctx.app.northService.getErrorFileContent(ctx.params.northId, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.attachment(ctx.params.filename);
    ctx.ok(fileStream);
  }

  async removeErrorFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.removeErrorFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async retryErrorFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.retryErrorFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async removeAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.removeAllErrorFiles(ctx.params.northId);
    ctx.noContent();
  }

  async retryAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.retryAllErrorFiles(ctx.params.northId);
    ctx.noContent();
  }

  async getCacheFiles(ctx: KoaContext<void, Array<NorthCacheFiles>>): Promise<void> {
    const filenameContains = (ctx.query.filenameContains as string) || null;
    const startTime = (ctx.query.start as string) || null;
    const endTime = (ctx.query.end as string) || null;
    const cacheFiles = await ctx.app.northService.getCacheFiles(ctx.params.northId, startTime, endTime, filenameContains);
    ctx.ok(cacheFiles);
  }

  async getCacheFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const fileStream = await ctx.app.northService.getCacheFileContent(ctx.params.northId, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.attachment(ctx.params.filename);
    ctx.ok(fileStream);
  }

  async removeCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.removeCacheFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async archiveCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.archiveCacheFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async removeAllCacheFiles(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.removeAllCacheFiles(ctx.params.northId);
    ctx.noContent();
  }

  async getArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const filenameContains = (ctx.query.filenameContains as string) || null;
    const startTime = (ctx.query.start as string) || null;
    const endTime = (ctx.query.end as string) || null;
    const archiveFiles = await ctx.app.northService.getArchiveFiles(ctx.params.northId, startTime, endTime, filenameContains);
    ctx.ok(archiveFiles);
  }

  async getArchiveFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const fileStream = await ctx.app.northService.getArchiveFileContent(ctx.params.northId, ctx.params.filename);
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.attachment(ctx.params.filename);
    ctx.ok(fileStream);
  }

  async removeArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.removeArchiveFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async retryArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.retryArchiveFiles(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async removeAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.removeAllArchiveFiles(ctx.params.northId);
    ctx.noContent();
  }

  async retryAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.retryAllArchiveFiles(ctx.params.northId);
    ctx.noContent();
  }

  async getCacheValues(ctx: KoaContext<void, Array<NorthCacheFiles>>): Promise<void> {
    const filenameContains = (ctx.query.filenameContains as string) || '';
    const cacheValues = await ctx.app.northService.getCacheValues(ctx.params.northId, filenameContains);
    ctx.ok(cacheValues);
  }

  async removeCacheValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.removeCacheValues(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async removeAllCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.removeAllCacheValues(ctx.params.northId);
    ctx.noContent();
  }

  async getErrorValues(ctx: KoaContext<void, void>): Promise<void> {
    const filenameContains = (ctx.query.filenameContains as string) || null;
    const startTime = (ctx.query.start as string) || null;
    const endTime = (ctx.query.end as string) || null;
    const errorValues = await ctx.app.northService.getErrorValues(ctx.params.northId, startTime, endTime, filenameContains);
    ctx.ok(errorValues);
  }

  async removeErrorValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.removeErrorValues(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async retryErrorValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.retryErrorValues(ctx.params.northId, ctx.request.body);
    ctx.noContent();
  }

  async removeAllErrorValues(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.removeAllErrorValues(ctx.params.northId);
    ctx.noContent();
  }

  async retryAllErrorValues(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.northService.retryAllErrorValues(ctx.params.northId);
    ctx.noContent();
  }

  async testNorthConnection(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>, void>): Promise<void> {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'north',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.northService.testNorth(ctx.params.id, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async listNorthItems(ctx: KoaContext<void, Array<NorthConnectorItemDTO<NorthItemSettings>>>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }
    const northItems = ctx.app.northService
      .getNorthItems(ctx.params.northId)
      .map(item => toNorthConnectorItemDTO(item, northConnector.type, ctx.app.encryptionService));
    ctx.ok(northItems);
  }

  async searchNorthItems(ctx: KoaContext<void, Page<NorthConnectorItemDTO<NorthItemSettings>>>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }
    const searchParams: NorthConnectorItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const page = ctx.app.northService.searchNorthItems(ctx.params.northId, searchParams);
    ctx.ok({
      content: page.content.map(item => toNorthConnectorItemDTO(item, northConnector.type, ctx.app.encryptionService)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async getNorthItem(ctx: KoaContext<void, NorthConnectorItemDTO<NorthItemSettings>>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }
    const item = ctx.app.northService.findNorthConnectorItemById(ctx.params.northId, ctx.params.id);
    if (item) {
      ctx.ok(toNorthConnectorItemDTO(item, northConnector.type, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async createNorthItem(
    ctx: KoaContext<NorthConnectorItemCommandDTO<NorthItemSettings>, NorthConnectorItemDTO<NorthItemSettings>>
  ): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }
    try {
      const item = await ctx.app.northService.createItem(ctx.params.northId!, ctx.request.body!);
      ctx.created(toNorthConnectorItemDTO(item, northConnector.type, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateNorthItem(ctx: KoaContext<NorthConnectorItemCommandDTO<NorthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.northService.updateItem(ctx.params.northId!, ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.deleteItem(ctx.params.northId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async enableNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.enableItem(ctx.params.northId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async disableNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.disableItem(ctx.params.northId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteAllNorthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.deleteAllItemsForNorthConnector(ctx.params.northId);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a North Connector (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async northConnectorItemsToCsv(
    ctx: KoaContext<{ items: Array<NorthConnectorItemDTO<NorthItemSettings>>; delimiter: string }, string>
  ): Promise<void> {
    const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === ctx.params.northType);
    if (!manifest) {
      return ctx.throw(404, 'North manifest not found');
    }

    ctx.body = northItemToFlattenedCSV(
      ctx.request.body!.items.map(item => toNorthConnectorItemDTO(item, manifest.id, ctx.app.encryptionService)),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportNorthItems(ctx: KoaContext<{ delimiter: string }, string>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.body = northItemToFlattenedCSV(
      northConnector.items.map(item => toNorthConnectorItemDTO(item, northConnector.type, ctx.app.encryptionService)),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async checkImportNorthItems(
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<NorthConnectorItemCommandDTO<NorthItemSettings>>;
        errors: Array<{ item: NorthConnectorItemCommandDTO<NorthItemSettings>; error: string }>;
      }
    >
  ): Promise<void> {
    try {
      return ctx.ok(
        await ctx.app.northService.checkCsvFileImport(
          ctx.params.northType,
          ctx.request.file,
          ctx.request.body!.delimiter,
          JSON.parse(ctx.request.body!.currentItems)
        )
      );
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
  }

  async importNorthItems(ctx: KoaContext<{ items: Array<NorthConnectorItemCommandDTO<NorthItemSettings>> }, void>): Promise<void> {
    try {
      await ctx.app.northService.importItems(ctx.params.northId, ctx.request.body!.items);
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    ctx.noContent();
  }
}
