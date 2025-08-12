import { KoaContext } from '../koa';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType,
  OIBusNorthType
} from '../../../shared/model/north-connector.model';
import JoiValidator from './validators/joi.validator';
import { toNorthConnectorDTO, toNorthConnectorLightDTO } from '../../service/north.service';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';

export default class NorthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getNorthConnectorTypes(ctx: KoaContext<void, Array<NorthType>>): Promise<void> {
    ctx.ok(
      ctx.app.northService.getInstalledNorthManifests().map(manifest => ({
        id: manifest.id,
        category: manifest.category,
        types: manifest.types
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

  async findById(ctx: KoaContext<void, NorthConnectorDTO<NorthSettings>>): Promise<void> {
    const northConnector = ctx.app.northService.findById(ctx.params.id);
    if (northConnector) {
      ctx.ok(toNorthConnectorDTO(northConnector, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, NorthConnectorDTO<NorthSettings>>): Promise<void> {
    try {
      const northConnector = await ctx.app.northService.createNorth(ctx.request.body!, (ctx.query.duplicate as string) || null);
      ctx.created(toNorthConnectorDTO(northConnector, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateNorth(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>): Promise<void> {
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

  async resetMetrics(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.oIBusService.resetNorthConnectorMetrics(ctx.params.northId);
    ctx.noContent();
  }

  async searchCacheContent(ctx: KoaContext<void, Array<{ metadataFilename: string; metadata: CacheMetadata }>>): Promise<void> {
    const nameContains = (ctx.query.nameContains as string) || null;
    const start = (ctx.query.start as string) || null;
    const end = (ctx.query.end as string) || null;
    const folder = (ctx.query.folder as string) || '';
    if (!['cache', 'archive', 'error'].includes(folder)) {
      return ctx.badRequest('A folder must be specified among "cache", "error" or "archive"');
    }
    const cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = await ctx.app.northService.searchCacheContent(
      ctx.params.northId,
      { start: start, end: end, nameContains },
      folder as 'cache' | 'archive' | 'error'
    );
    ctx.ok(cacheContentList);
  }

  async getCacheContentFileStream(ctx: KoaContext<void, ReadStream>): Promise<void> {
    const folder = (ctx.query.folder as string) || '';
    const filename = (ctx.params.filename as string) || '';
    if (!['cache', 'archive', 'error'].includes(folder)) {
      return ctx.badRequest('A folder must be specified among "cache", "error" or "archive"');
    }
    if (!filename) {
      return ctx.badRequest('A filename must be specified');
    }
    const fileStream = await ctx.app.northService.getCacheContentFileStream(
      ctx.params.northId,
      folder as 'cache' | 'archive' | 'error',
      filename
    );
    if (!fileStream) {
      return ctx.notFound();
    }
    ctx.attachment(ctx.params.filename);
    ctx.ok(fileStream);
  }

  async removeCacheContent(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const folder = (ctx.query.folder as string) || '';
    if (!['cache', 'archive', 'error'].includes(folder)) {
      return ctx.badRequest('A folder must be specified among "cache", "error" or "archive"');
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }

    await ctx.app.northService.removeCacheContent(ctx.params.northId, folder as 'cache' | 'archive' | 'error', ctx.request.body);
    ctx.noContent();
  }

  async removeAllCacheContent(ctx: KoaContext<void, void>): Promise<void> {
    const folder = (ctx.query.folder as string) || '';
    if (!['cache', 'archive', 'error'].includes(folder)) {
      return ctx.badRequest('A folder must be specified among "cache", "error" or "archive"');
    }
    await ctx.app.northService.removeAllCacheContent(ctx.params.northId, folder as 'cache' | 'archive' | 'error');
    ctx.noContent();
  }

  async moveCacheContent(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const originFolder = (ctx.query.originFolder as string) || '';
    if (!['cache', 'archive', 'error'].includes(originFolder)) {
      return ctx.badRequest('The originFolder must be specified among "cache", "error" or "archive"');
    }
    const destinationFolder = (ctx.query.destinationFolder as string) || '';
    if (!['cache', 'archive', 'error'].includes(destinationFolder)) {
      return ctx.badRequest('The destinationFolder must be specified among "cache", "error" or "archive"');
    }
    if (!Array.isArray(ctx.request.body)) {
      return ctx.badRequest('Invalid file list');
    }
    await ctx.app.northService.moveCacheContent(
      ctx.params.northId,
      originFolder as 'cache' | 'archive' | 'error',
      destinationFolder as 'cache' | 'archive' | 'error',
      ctx.request.body
    );
    ctx.noContent();
  }

  async moveAllCacheContent(ctx: KoaContext<void, void>): Promise<void> {
    const originFolder = (ctx.query.originFolder as string) || '';
    if (!['cache', 'archive', 'error'].includes(originFolder)) {
      return ctx.badRequest('The originFolder must be specified among "cache", "error" or "archive"');
    }
    const destinationFolder = (ctx.query.destinationFolder as string) || '';
    if (!['cache', 'archive', 'error'].includes(destinationFolder)) {
      return ctx.badRequest('The destinationFolder must be specified among "cache", "error" or "archive"');
    }
    await ctx.app.northService.moveAllCacheContent(
      ctx.params.northId,
      originFolder as 'cache' | 'archive' | 'error',
      destinationFolder as 'cache' | 'archive' | 'error'
    );
    ctx.noContent();
  }

  async testNorthConnection(ctx: KoaContext<NorthSettings, void>): Promise<void> {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'north',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.northService.testNorth(ctx.params.id, ctx.query.northType as OIBusNorthType, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
