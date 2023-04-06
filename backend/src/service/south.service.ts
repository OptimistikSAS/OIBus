import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';

// South imports
import FolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import OPCUA_HA from '../south/south-opcua-ha/south-opcua-ha';
import OPCUA_DA from '../south/south-opcua-da/south-opcua-da';
import MQTT from '../south/south-mqtt/south-mqtt';
import SQL from '../south/south-sql/south-sql';
import ADS from '../south/south-ads/south-ads';
import Modbus from '../south/south-modbus/south-modbus';
import OIConnect from '../south/south-oiconnect/south-oiconnect';
import OPCHDA from '../south/south-opchda/south-opchda';

import { SouthConnectorDTO, OibusItemDTO } from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';

const southList = {
  FolderScanner,
  MQTT,
  OPCUA_HA,
  OPCUA_DA,
  OPCHDA,
  SQL,
  ADS,
  Modbus,
  OIConnect
};

export default class SouthService {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  /**
   * Return the South connector
   */
  createSouth(
    settings: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    addValues: (southId: string, values: Array<any>) => Promise<void>,
    addFile: (southId: string, filePath: string) => Promise<void>,
    baseFolder: string,
    streamMode: boolean,
    logger: pino.Logger
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
      logger,
      baseFolder,
      streamMode
    );
  }

  /**
   * Retrieve a south connector from the config
   */
  getSouth(southId: string): SouthConnectorDTO | null {
    return this.repositoryService.southConnectorRepository.getSouthConnector(southId);
  }

  getSouthList(): Array<SouthConnectorDTO> {
    return this.repositoryService.southConnectorRepository.getSouthConnectors();
  }

  getSouthItems(southId: string): Array<OibusItemDTO> {
    return this.repositoryService.southItemRepository.getSouthItems(southId);
  }
}
