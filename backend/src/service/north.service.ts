import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';
import NorthConnector from '../north/north-connector';
import NorthConsole from '../north/north-console/north-console';
import NorthOIAnalytics from '../north/north-oianalytics/north-oianalytics';
import NorthAzureBlob from '../north/north-azure-blob/north-azure-blob';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import NorthAmazonS3 from '../north/north-amazon-s3/north-amazon-s3';

const northList = {
  Console: NorthConsole,
  OIAnalytics: NorthOIAnalytics,
  AzureBlob: NorthAzureBlob,
  AWS3: NorthAmazonS3
};

export default class NorthService {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  /**
   * Return the North connector
   */
  createNorth(settings: NorthConnectorDTO, baseFolder: string, logger: pino.Logger): NorthConnector {
    // @ts-ignore
    return new northList[settings.type](settings, this.encryptionService, this.proxyService, this.repositoryService, logger, baseFolder);
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
}
