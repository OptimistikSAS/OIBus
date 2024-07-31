import { KoaContext } from '../koa';
import {
  NorthCacheSettingsDTO,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorWithItemsCommandDTO,
  NorthType
} from '../../../../shared/model/north-connector.model';
import JoiValidator from './validators/joi.validator';

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
}
