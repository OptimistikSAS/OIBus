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
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthType } from '../../../shared/model/north-connector.model';
import JoiValidator from '../../validators/joi.validator';

// TODO: retrieve north types from a local store
const manifests = [
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
      manifests.map(connector => ({
        category: connector.category,
        type: connector.name,
        description: connector.description,
        modes: connector.modes
      }))
    );
  }

  async getNorthConnectorManifest(ctx: KoaContext<void, object>): Promise<void> {
    const manifest = manifests.find(north => north.name === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'North not found');
    }
    ctx.ok(manifest);
  }

  async getNorthConnectors(ctx: KoaContext<void, Array<NorthConnectorDTO>>): Promise<void> {
    const northConnectors = ctx.app.repositoryService.northConnectorRepository.getNorthConnectors();
    ctx.ok(northConnectors);
  }

  async getNorthConnector(ctx: KoaContext<void, NorthConnectorDTO>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.id);
    if (northConnector) {
      ctx.ok(northConnector);
    } else {
      ctx.notFound();
    }
  }

  async createNorthConnector(ctx: KoaContext<NorthConnectorCommandDTO, void>): Promise<void> {
    try {
      const manifest = manifests.find(north => north.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'North not found');
      }

      await this.validator.validate(manifest.schema, ctx.request.body?.settings);

      const command: NorthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        const northConnector = ctx.app.repositoryService.northConnectorRepository.createNorthConnector(command);
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
      const manifest = manifests.find(north => north.name === ctx.request.body?.type);
      if (!manifest) {
        return ctx.throw(404, 'North not found');
      }

      await this.validator.validate(manifest.schema, ctx.request.body?.settings);

      const command: NorthConnectorCommandDTO | undefined = ctx.request.body;
      if (command) {
        ctx.app.repositoryService.northConnectorRepository.updateNorthConnector(ctx.params.id, command);
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
      ctx.app.repositoryService.northConnectorRepository.deleteNorthConnector(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
