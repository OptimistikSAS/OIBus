import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import NorthOIAnalytics from '../north/north-oianalytics/north-oianalytics';
import NorthAzureBlob from '../north/north-azure-blob/north-azure-blob';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import NorthAmazonS3 from '../north/north-amazon-s3/north-amazon-s3';
import NorthFileWriter from '../north/north-file-writer/north-file-writer';
import azureManifest from '../north/north-azure-blob/manifest';
import oianalyticsManifest from '../north/north-oianalytics/manifest';
import fileWriterManifest from '../north/north-file-writer/manifest';
import consoleManifest from '../north/north-console/manifest';
import amazonManifest from '../north/north-amazon-s3/manifest';

const northList: Array<{ class: typeof NorthConnector<any>; manifest: NorthConnectorManifest<boolean> }> = [
  { class: NorthConsole, manifest: consoleManifest },
  { class: NorthOIAnalytics, manifest: oianalyticsManifest },
  { class: NorthAzureBlob, manifest: azureManifest },
  { class: NorthAmazonS3, manifest: amazonManifest },
  { class: NorthFileWriter, manifest: fileWriterManifest }
];

export default class NorthService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  /**
   * Return the North connector
   */
  createNorth(settings: NorthConnectorDTO, baseFolder: string, logger: pino.Logger): NorthConnector {
    const NorthConnector = northList.find(connector => connector.class.type === settings.type);
    if (!NorthConnector) {
      throw Error(`North connector of type ${settings.type} not installed`);
    }

    return new NorthConnector.class(settings, this.encryptionService, this.repositoryService, logger, baseFolder);
  }

  /**
   * Retrieve a north connector from the config
   */
  getNorth(northId: string): NorthConnectorDTO | null {
    return this.repositoryService.northConnectorRepository.getNorthConnector(northId);
  }

  getNorthList(): Array<NorthConnectorDTO> {
    return this.repositoryService.northConnectorRepository.getNorthConnectors();
  }

  getInstalledNorthManifests(): Array<NorthConnectorManifest> {
    return northList.map(element => element.manifest);
  }
}
