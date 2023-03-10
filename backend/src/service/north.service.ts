import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';
import NorthConnector from '../north/north-connector';
import Console from '../north/north-console/north-console';
import OIAnalytics from '../north/north-oianalytics/north-oianalytics';

import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

const northList = {
  Console,
  OIAnalytics
};

export default class NorthService {
  private readonly _logger: pino.Logger;
  private readonly proxyService: ProxyService;
  private readonly repositoryService: RepositoryService;
  private readonly encryptionService: EncryptionService;

  constructor(proxyService: ProxyService, encryptionService: EncryptionService, repositoryService: RepositoryService, logger: pino.Logger) {
    this.proxyService = proxyService;
    this.encryptionService = encryptionService;
    this.repositoryService = repositoryService;
    this._logger = logger;
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  /**
   * Return the North connector
   */
  createNorth(settings: NorthConnectorDTO, baseFolder: string): NorthConnector {
    // @ts-ignore
    return new northList[settings.type](
      settings,
      this.encryptionService,
      this.proxyService,
      this.repositoryService,
      this.logger.child({ scope: `north:${settings.name}` }),
      baseFolder
    );
  }

  /**
   * Retrieve a north connector from the config
   */
  getNorth(northId: string): NorthConnectorDTO {
    return this.repositoryService.northConnectorRepository.getNorthConnector(northId);
  }

  getNorthList(): Array<NorthConnectorDTO> {
    return this.repositoryService.northConnectorRepository.getNorthConnectors();
  }
}
