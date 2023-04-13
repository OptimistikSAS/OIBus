import { KoaContext } from '../koa';

import amazonManifest from '../../north/north-amazon-s3/manifest';
import consoleManifest from '../../north/north-console/manifest';
import csvToHttpManifest from '../../north/north-csv-to-http/manifest';
import fileWriterManifest from '../../north/north-file-writer/manifest';
import influxManifest from '../../north/north-influx-db/manifest';
import mongoManifest from '../../north/north-mongo-db/manifest';
import mqttManifest from '../../north/north-mqtt/manifest';
import oianalyticsManifest from '../../north/north-oianalytics/manifest';
import oiconnectManifest from '../../north/north-oiconnect/manifest';
import timescaleManifest from '../../north/north-timescale-db/manifest';
import watsyManifest from '../../north/north-watsy/manifest';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthType } from '../../../../shared/model/north-connector.model';
import JoiValidator from '../../validators/joi.validator';
import { DateTime } from 'luxon';

// TODO: retrieve north types from a local store
export const northManifests = [
  watsyManifest,
  oiconnectManifest,
  timescaleManifest,
  oianalyticsManifest,
  mqttManifest,
  mongoManifest,
  influxManifest,
  fileWriterManifest,
  csvToHttpManifest,
  consoleManifest,
  amazonManifest
];

export default class NorthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getNorthConnectorTypes(ctx: KoaContext<void, Array<NorthType>>): Promise<void> {
    ctx.ok(
      northManifests.map(connector => ({
        category: connector.category,
        type: connector.name,
        description: connector.description,
        modes: connector.modes
      }))
    );
  }

  async getNorthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = northManifests.find(north => north.name === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'North not found');
    }
    ctx.ok(manifest);
  }

  async getNorthConnectors(ctx: KoaContext<void, Array<NorthConnectorDTO>>): Promise<void> {
    const northConnectors = ctx.app.repositoryService.northConnectorRepository.getNorthConnectors();
    ctx.ok(
      northConnectors.map(connector => {
        const manifest = northManifests.find(north => north.name === connector.type);
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
      const manifest = northManifests.find(north => north.name === northConnector.type);
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

  async createNorthConnector(ctx: KoaContext<NorthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = northManifests.find(north => north.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'North not found');
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body?.settings);

      const command: NorthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);
        const northConnector = await ctx.app.reloadService.onCreateNorth(command);
        ctx.created(northConnector);
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateNorthConnector(ctx: KoaContext<NorthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = northManifests.find(north => north.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'North not found');
      }

      await this.validator.validateSettings(manifest.settings, ctx.request.body?.settings);

      const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
      if (!northConnector) {
        return ctx.notFound();
      }

      const command: NorthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        command.settings = await ctx.app.encryptionService.encryptConnectorSecrets(
          command.settings,
          northConnector.settings,
          manifest.settings
        );
        await ctx.app.reloadService.onUpdateNorthSettings(ctx.params.id, command);
        ctx.noContent();
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteNorthConnector(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
    if (northConnector) {
      await ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscriptions(ctx.params.id);
      await ctx.app.reloadService.onDeleteNorth(ctx.params.id);
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
    const errorFiles = await ctx.app.reloadService.getErrorFiles(northConnector.id, '', '', fileNameContains);
    ctx.ok(errorFiles);
  }

  async removeFileErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.removeErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async retryFileErrors(ctx: KoaContext<Array<string>, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    if (!Array.isArray(ctx.request.body)) {
      return ctx.throw(400, 'Invalid file list');
    }

    await ctx.app.reloadService.retryErrorFiles(northConnector.id, ctx.request.body);
    ctx.noContent();
  }

  async removeAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.removeAllErrorFiles(northConnector.id);
    ctx.noContent();
  }

  async retryAllErrorFiles(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.retryAllErrorFiles(northConnector.id);
    ctx.noContent();
  }
}
