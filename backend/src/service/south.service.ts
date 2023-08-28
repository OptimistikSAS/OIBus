import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';

// South imports
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthOPCUA from '../south/south-opcua/south-opcua';
import SouthOPCHDA from '../south/south-opchda/south-opchda';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import SouthADS from '../south/south-ads/south-ads';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthOIAnalytics from '../south/south-oianalytics/south-oianalytics';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';
import SouthSlims from '../south/south-slims/south-slims';

const southList: Array<typeof SouthConnector<any, any>> = [
  SouthFolderScanner,
  SouthMQTT,
  SouthOPCUA,
  SouthOPCHDA,
  SouthMSSQL,
  SouthMySQL,
  SouthODBC,
  SouthOracle,
  SouthPostgreSQL,
  SouthSQLite,
  SouthADS,
  SouthModbus,
  SouthOIAnalytics,
  SouthSlims
];

export default class SouthService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  /**
   * Return the South connector
   */
  createSouth(
    settings: SouthConnectorDTO,
    items: Array<SouthConnectorItemDTO>,
    addValues: (southId: string, values: Array<any>) => Promise<void>,
    addFile: (southId: string, filePath: string) => Promise<void>,
    baseFolder: string,
    logger: pino.Logger
  ): SouthConnector {
    const SouthConnector = southList.find(connector => connector.type === settings.type);
    if (!SouthConnector) {
      throw Error(`South connector of type ${settings.type} not installed`);
    }
    return new SouthConnector(settings, items, addValues, addFile, this.encryptionService, this.repositoryService, logger, baseFolder);
  }

  /**
   * Retrieve south class
   * @param type SouthConnector type ID
   */
  getSouthClass(type: string): typeof SouthConnector {
    const SouthConnectorClass = southList.find(connector => connector.type === type);
    if (!SouthConnectorClass) {
      throw Error(`South connector of type ${type} not installed`);
    }

    return SouthConnectorClass;
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

  getSouthItems(southId: string): Array<SouthConnectorItemDTO> {
    return this.repositoryService.southItemRepository.getSouthItems(southId);
  }
}
