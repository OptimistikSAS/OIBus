import { KoaContext } from "../koa";

import amazonManifest from "../../north/north-amazon-s3/manifest";
import consoleManifest from "../../north/north-console/manifest";
import csvToHttpManifest from "../../north/north-csv-to-http/manifest";
import fileWriterManifest from "../../north/north-file-writer/manifest";
import influxManifest from "../../north/north-influx-db/manifest";
import mongoManifest from "../../north/north-mongo-db/manifest";
import mqttManifest from "../../north/north-mqtt/manifest";
import oianalyticsManifest from "../../north/north-oianalytics/manifest";
import oiconnectManifest from "../../north/north-oiconnect/manifest";
import timescaleManifest from "../../north/north-timescale-db/manifest";
import watsyManifest from "../../north/north-watsy/manifest";

import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthType,
} from "../../model/north-connector.model";

// TODO: retrieve north types from a local store
const manifest = [
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
  amazonManifest,
];

const getNorthConnectorTypes = async (
  ctx: KoaContext<void, Array<NorthType>>
) => {
  ctx.ok(
    manifest.map((connector) => ({
      category: connector.category,
      type: connector.name,
      description: connector.description,
      modes: connector.modes,
    }))
  );
};

const getNorthConnectorManifest = async (ctx: KoaContext<void, object>) => {
  const connector = manifest.find((south) => south.name === ctx.params.id);
  if (!connector) {
    ctx.throw(404, "North not found");
  }
  ctx.ok(connector);
};

const getNorthConnectors = async (
  ctx: KoaContext<void, Array<NorthConnectorDTO>>
) => {
  const northConnectors =
    ctx.app.repositoryService.northConnectorRepository.getNorthConnectors();
  ctx.ok(northConnectors);
};

const getNorthConnector = async (ctx: KoaContext<void, NorthConnectorDTO>) => {
  const northConnector =
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector(
      ctx.params.id
    );
  ctx.ok(northConnector);
};

const createNorthConnector = async (
  ctx: KoaContext<NorthConnectorCommandDTO, void>
) => {
  const northConnector =
    ctx.app.repositoryService.northConnectorRepository.createNorthConnector(
      ctx.request.body
    );
  ctx.created(northConnector);
};

const updateNorthConnector = async (
  ctx: KoaContext<NorthConnectorCommandDTO, void>
) => {
  ctx.app.repositoryService.northConnectorRepository.updateNorthConnector(
    ctx.params.id,
    ctx.request.body
  );
  ctx.noContent();
};

const deleteNorthConnector = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.northConnectorRepository.deleteNorthConnector(
    ctx.params.id
  );
  ctx.noContent();
};

export default {
  getNorthConnectorTypes,
  getNorthConnectorManifest,
  getNorthConnectors,
  getNorthConnector,
  createNorthConnector,
  updateNorthConnector,
  deleteNorthConnector,
};
