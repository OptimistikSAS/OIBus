import { BaseEntity, Instant } from './types';
import { RegistrationStatus } from '../../shared/model/engine.model';

export interface OIAnalyticsRegistration extends BaseEntity {
  host: string;
  activationCode: string | null;
  token: string | null;
  publicCipherKey: string | null;
  privateCipherKey: string | null;
  status: RegistrationStatus;
  activationDate: Instant;
  activationExpirationDate?: Instant;
  checkUrl: string | null;
  useProxy: boolean;
  proxyUrl: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  acceptUnauthorized: boolean;
  commandRefreshInterval: number;
  commandRetryInterval: number;
  messageRetryInterval: number;
  commandPermissions: {
    updateVersion: boolean;
    restartEngine: boolean;
    regenerateCipherKeys: boolean;
    updateEngineSettings: boolean;
    updateRegistrationSettings: boolean;
    createScanMode: boolean;
    updateScanMode: boolean;
    deleteScanMode: boolean;
    createIpFilter: boolean;
    updateIpFilter: boolean;
    deleteIpFilter: boolean;
    createCertificate: boolean;
    updateCertificate: boolean;
    deleteCertificate: boolean;
    createHistoryQuery: boolean;
    updateHistoryQuery: boolean;
    deleteHistoryQuery: boolean;
    createOrUpdateHistoryItemsFromCsv: boolean;
    createSouth: boolean;
    updateSouth: boolean;
    deleteSouth: boolean;
    createOrUpdateSouthItemsFromCsv: boolean;
    createNorth: boolean;
    updateNorth: boolean;
    deleteNorth: boolean;
  };
}

export interface OIAnalyticsRegistrationEditCommand {
  host: string;
  useProxy: boolean;
  proxyUrl: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  acceptUnauthorized: boolean;
  commandRefreshInterval: number;
  commandRetryInterval: number;
  messageRetryInterval: number;
  commandPermissions: {
    updateVersion: boolean;
    restartEngine: boolean;
    regenerateCipherKeys: boolean;
    updateEngineSettings: boolean;
    updateRegistrationSettings: boolean;
    createScanMode: boolean;
    updateScanMode: boolean;
    deleteScanMode: boolean;
    createIpFilter: boolean;
    updateIpFilter: boolean;
    deleteIpFilter: boolean;
    createCertificate: boolean;
    updateCertificate: boolean;
    deleteCertificate: boolean;
    createHistoryQuery: boolean;
    updateHistoryQuery: boolean;
    deleteHistoryQuery: boolean;
    createOrUpdateHistoryItemsFromCsv: boolean;
    createSouth: boolean;
    updateSouth: boolean;
    deleteSouth: boolean;
    createOrUpdateSouthItemsFromCsv: boolean;
    createNorth: boolean;
    updateNorth: boolean;
    deleteNorth: boolean;
  };
}
