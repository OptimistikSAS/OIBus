import { KoaContext } from '../koa';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthConnectorWithoutSubscriptionsCommandDTO,
  NorthType
} from '../../../../shared/model/north-connector.model';
import JoiValidator from './validators/joi.validator';
import { toNorthConnectorDTO, toNorthConnectorLightDTO } from '../../service/north.service';
import { NorthSettings } from '../../../../shared/model/north-settings.model';

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
      const northConnector = await ctx.app.northService.createNorth(ctx.request.body!);
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

  async updateNorthWithoutSubscriptions(ctx: KoaContext<NorthConnectorWithoutSubscriptionsCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.northService.updateNorthWithoutSubscriptions(ctx.params.id!, ctx.request.body!);
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
    // TODO: await ctx.app.reloadService.oibusEngine.resetNorthMetrics(ctx.params.northId);
    ctx.noContent();
  }

  async getFileErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // const fileNameContains = (ctx.query.fileNameContains as string) || '';
    const errorFiles: object = []; // TODO await ctx.app.northService.getErrorFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getFileErrorContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.attachment(ctx.params.filename);
    ctx.noContent();
    // TODO
    // const fileStream = await ctx.app.northService.getErrorFileContent(northConnector.id, ctx.params.filename);
    // if (!fileStream) {
    //   return ctx.notFound();
    // }
    // ctx.ok(fileStream);
  }

  async removeFileErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO: await ctx.app.northService.removeErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryErrorFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO : await ctx.app.reloadService.oibusEngine.retryErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    //TODO  await ctx.app.reloadService.oibusEngine.removeAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO await ctx.app.reloadService.oibusEngine.retryAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // const fileNameContains = (ctx.query.fileNameContains as string) || '';
    // TODO const errorFiles = await ctx.app.reloadService.oibusEngine.getCacheFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok([]);
  }

  async getCacheFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.attachment(ctx.params.filename);
    ctx.noContent();
    // TODO
    // const fileStream = await ctx.app.reloadService.oibusEngine.getCacheFileContent(northConnector.id, ctx.params.filename);
    // if (!fileStream) {
    //   return ctx.notFound();
    // }
    // ctx.ok(fileStream);
  }

  async removeCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.removeCacheFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async archiveCacheFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.archiveCacheFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async getArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO
    // const fileNameContains = (ctx.query.fileNameContains as string) || '';
    // const errorFiles = await ctx.app.reloadService.oibusEngine.getArchiveFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok([]);
  }

  async getArchiveFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    ctx.noContent();
    // TODO
    // ctx.attachment(ctx.params.filename);
    // const fileStream = await ctx.app.reloadService.oibusEngine.getArchiveFileContent(northConnector.id, ctx.params.filename);
    // if (!fileStream) {
    //   return ctx.notFound();
    // }
    // ctx.ok(fileStream);
  }

  async removeArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.removeArchiveFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryArchiveFiles(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.retryArchiveFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }
    // TODO
    // await ctx.app.reloadService.oibusEngine.removeAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.retryAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // const fileNameContains = (ctx.query.fileNameContains as string) || '';
    // TODO const cacheValues = await ctx.app.reloadService.oibusEngine.getCacheValues(northConnector.id, fileNameContains);
    ctx.ok([]);
  }

  async removeCacheValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO await ctx.app.reloadService.oibusEngine.removeCacheValues(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO
    // await ctx.app.reloadService.oibusEngine.removeAllCacheValues(northConnector.id);
    ctx.noContent();
  }

  async getValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO const fileNameContains = (ctx.query.fileNameContains as string) || '';
    // const errorFiles = await ctx.app.reloadService.oibusEngine.getValueErrors(northConnector.id, '', '', fileNameContains);
    ctx.ok([]);
  }

  async removeValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO await ctx.app.reloadService.oibusEngine.removeValueErrors(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO await ctx.app.reloadService.oibusEngine.removeAllValueErrors(northConnector.id);
    ctx.noContent();
  }

  async retryValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    // TODO await ctx.app.reloadService.oibusEngine.retryValueErrors(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryAllValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.findNorthById(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    // TODO await ctx.app.reloadService.oibusEngine.retryAllValueErrors(northConnector.id);
    ctx.noContent();
  }

  async testNorthConnection(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>): Promise<void> {
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
}
