import pino from 'pino';
import { SouthConnectorItemDTO, SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';
import EncryptionService from '../service/encryption.service';
import { SouthSettings } from '../../../shared/model/south-settings.model';

export interface QueriesFile {
  fileQuery(items: Array<SouthConnectorItemDTO<any>>): Promise<void>;
}

export interface QueriesLastPoint {
  lastPointQuery(items: Array<SouthConnectorItemDTO<any>>): Promise<void>;
}

export interface QueriesHistory {
  historyQuery(items: Array<SouthConnectorItemDTO<any>>, startTime: Instant, endTime: Instant): Promise<Instant>;
}

export interface QueriesSubscription {
  subscribe(items: Array<SouthConnectorItemDTO<any>>): Promise<void>;
}

export abstract class TestsConnection {
  /**
   * @throws {Error} Error with a message specifying wrong settings
   */
  static async testConnection(settings: SouthSettings, logger: pino.Logger, _encryptionService: EncryptionService): Promise<void> {
    logger.warn('testConnection method must be override');
  }
}
