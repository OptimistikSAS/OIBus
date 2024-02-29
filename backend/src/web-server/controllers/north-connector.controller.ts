import { KoaContext } from '../koa';
import {
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

  async getNorthConnectors(ctx: KoaContext<void, Array<NorthConnectorDTO>>): Promise<void> {
    const northConnectors = ctx.app.repositoryService.northConnectorRepository.getNorthConnectors();
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

  async getNorthConnector(ctx: KoaContext<void, NorthConnectorDTO>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
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

  async createNorthConnector(ctx: KoaContext<NorthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.subscriptions || !ctx.request.body.north) {
      return ctx.badRequest();
    }
    const command = ctx.request.body!.north;

    try {
      const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
      if (!manifest) {
        return ctx.throw(404, 'North manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, command.settings);
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);

      const subscriptionsToAdd = ctx.request.body.subscriptions
        .filter(element => element.type === 'south')
        .map(element => element.subscription!.id);
      const externalSubscriptionsToAdd = ctx.request.body.subscriptions
        .filter(element => element.type === 'external-source')
        .map(element => element.externalSubscription!.id);

      const northConnector = await ctx.app.reloadService.onCreateNorth(command);

      for (const subscription of subscriptionsToAdd) {
        ctx.app.repositoryService.subscriptionRepository.createNorthSubscription(northConnector.id, subscription);
      }
      for (const subscription of externalSubscriptionsToAdd) {
        ctx.app.repositoryService.subscriptionRepository.createExternalNorthSubscription(northConnector.id, subscription);
      }

      if (command.enabled) {
        await ctx.app.reloadService.onStartNorth(northConnector.id);
      }
      ctx.created(northConnector);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateNorthConnector(ctx: KoaContext<NorthConnectorWithItemsCommandDTO, void>): Promise<void> {
    if (!ctx.request.body || !ctx.request.body.subscriptions || !ctx.request.body.subscriptionsToDelete || !ctx.request.body.north) {
      return ctx.badRequest();
    }
    const command = ctx.request.body!.north;

    try {
      const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);
      if (!manifest) {
        return ctx.throw(404, 'North manifest not found');
      }

      await this.validator.validateSettings(manifest.settings, command!.settings);

      const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
      if (!northConnector) {
        return ctx.notFound();
      }

      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        northConnector.settings,
        manifest.settings
      );

      const existingSubscriptions = ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions(ctx.params.id);
      const existingExternalSubscriptions = ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions(ctx.params.id);
      const subscriptionsToAdd = ctx.request.body.subscriptions
        .filter(
          element =>
            element.type === 'south' &&
            !existingSubscriptions.find(existingSubscription => existingSubscription === element.subscription!.id)
        )
        .map(element => element.subscription!.id);
      const externalSubscriptionsToAdd = ctx.request.body.subscriptions
        .filter(
          element =>
            element.type === 'external-source' &&
            !existingExternalSubscriptions.find(existingSubscription => existingSubscription === element.externalSubscription!.id)
        )
        .map(element => element.externalSubscription!.id);

      const subscriptionsToRemove = ctx.request.body.subscriptionsToDelete
        .filter(element => element.type === 'south')
        .map(element => element.subscription!.id);
      const externalSubscriptionsToRemove = ctx.request.body.subscriptionsToDelete
        .filter(element => element.type === 'external-source')
        .map(element => element.externalSubscription!.id);
      for (const subscription of subscriptionsToAdd) {
        ctx.app.repositoryService.subscriptionRepository.createNorthSubscription(ctx.params.id, subscription);
      }
      for (const subscription of externalSubscriptionsToAdd) {
        ctx.app.repositoryService.subscriptionRepository.createExternalNorthSubscription(ctx.params.id, subscription);
      }
      for (const subscription of subscriptionsToRemove) {
        ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscription(ctx.params.id, subscription);
      }
      for (const subscription of externalSubscriptionsToRemove) {
        ctx.app.repositoryService.subscriptionRepository.deleteExternalNorthSubscription(ctx.params.id, subscription);
      }
      await ctx.app.reloadService.onUpdateNorthSettings(ctx.params.id, command);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteNorthConnector(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
    if (northConnector) {
      await ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscriptions(ctx.params.id);
      await ctx.app.repositoryService.subscriptionRepository.deleteExternalNorthSubscriptions(ctx.params.id);
      await ctx.app.reloadService.onDeleteNorth(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  startNorthConnector = async (ctx: KoaContext<void, void>) => {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
    if (!northConnector) {
      return ctx.notFound();
    }

    try {
      await ctx.app.reloadService.onStartNorth(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  stopNorthConnector = async (ctx: KoaContext<void, void>) => {
    const southConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
    if (!southConnector) {
      return ctx.notFound();
    }

    try {
      await ctx.app.reloadService.onStopNorth(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  async resetNorthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (northConnector) {
      await ctx.app.reloadService.oibusEngine.resetNorthMetrics(ctx.params.northId);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  async getFileErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getErrorFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getFileErrorContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.retryAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getCacheFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getCacheFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getArchiveFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async getArchiveFileContent(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllArchiveFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.retryAllArchiveFiles(northConnector.id);
    ctx.noContent();
  }

  async getCacheValues(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const cacheValues = await ctx.app.reloadService.oibusEngine.getCacheValues(northConnector.id, fileNameContains);
    ctx.ok(cacheValues);
  }

  async removeCacheValues(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllCacheValues(northConnector.id);
    ctx.noContent();
  }

  async getValueErrors(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const fileNameContains = ctx.query.fileNameContains || '';
    const errorFiles = await ctx.app.reloadService.oibusEngine.getValueErrors(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async removeValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.oibusEngine.removeAllValueErrors(northConnector.id);
    ctx.noContent();
  }

  async retryValueErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
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
        northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
        if (!northConnector) {
          return ctx.notFound();
        }
      }
      await this.validator.validateSettings(manifest.settings, ctx.request.body!.settings);
      const command: NorthConnectorDTO = {
        id: northConnector?.id || 'test',
        ...ctx.request.body!,
        name: northConnector?.name || `${ctx.request.body!.type}:test-connection`
      };
      command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.settings,
        northConnector?.settings || null,
        manifest.settings
      );
      const logger = ctx.app.logger.child({ scopeType: 'north', scopeId: command.id, scopeName: command.name }, { level: 'silent' });
      const northToTest = ctx.app.northService.createNorth(command, 'baseFolder', logger);
      await northToTest.testConnection();

      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }
}
