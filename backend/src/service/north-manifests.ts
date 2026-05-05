import { NorthConnectorManifest } from '../../shared/model/north-connector.model';
import azureManifest from '../north/north-azure-blob/manifest';
import oianalyticsManifest from '../north/north-oianalytics/manifest';
import fileWriterManifest from '../north/north-file-writer/manifest';
import consoleManifest from '../north/north-console/manifest';
import amazonManifest from '../north/north-amazon-s3/manifest';
import sftpManifest from '../north/north-sftp/manifest';
import restManifest from '../north/north-rest/manifest';
import opcuaManifest from '../north/north-opcua/manifest';
import mqttManifest from '../north/north-mqtt/manifest';
import modbusManifest from '../north/north-modbus/manifest';

export const northManifestList: Array<NorthConnectorManifest> = [
  consoleManifest,
  oianalyticsManifest,
  azureManifest,
  amazonManifest,
  fileWriterManifest,
  sftpManifest,
  restManifest,
  opcuaManifest,
  modbusManifest,
  mqttManifest
];
