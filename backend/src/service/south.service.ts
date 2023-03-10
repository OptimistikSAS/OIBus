import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';

// South imports
import FolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import OPCUA_HA from '../south/south-opcua-ha/south-opcua-ha';

import { SouthConnectorDTO, SouthItemDTO } from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';

const southList = {
  FolderScanner,
  OPCUA_HA
};

export default class SouthService {
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
   * Return the South connector
   */
  createSouth(
    settings: SouthConnectorDTO,
    items: Array<SouthItemDTO>,
    addValues: (southId: string, values: Array<any>) => Promise<void>,
    addFile: (southId: string, filePath: string) => Promise<void>,
    baseFolder: string,
    streamMode: boolean
  ): SouthConnector {
    // @ts-ignore
    return new southList[settings.type](
      settings,
      items,
      addValues,
      addFile,
      this.encryptionService,
      this.proxyService,
      this.repositoryService,
      this.logger.child({ scope: `south:${settings.name}` }),
      baseFolder,
      streamMode
    );
  }

  /**
   * Retrieve a south connector from the config
   */
  getSouth(southId: string): SouthConnectorDTO {
    return this.repositoryService.southConnectorRepository.getSouthConnector(southId);
  }

  getSouthList(): Array<SouthConnectorDTO> {
    return this.repositoryService.southConnectorRepository.getSouthConnectors();
  }

  getSouthItems(southId: string): Array<SouthItemDTO> {
    return this.repositoryService.southItemRepository.getSouthItems(southId);
  }
}
