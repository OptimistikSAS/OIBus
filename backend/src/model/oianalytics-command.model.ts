import { BaseEntity, Instant } from './types';
import { OIBusCommandStatus, OIBusCommandType } from '../../shared/model/command.model';
import { EngineSettingsCommandDTO } from '../../shared/model/engine.model';
import { ScanModeCommandDTO } from '../../shared/model/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthConnectorCommandDTO } from '../../shared/model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { IPFilterCommandDTO } from '../../shared/model/ip-filter.model';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryStatus } from '../../shared/model/history-query.model';

export interface BaseOIBusCommand extends BaseEntity {
  type: OIBusCommandType;
  ack: boolean;
  completedDate: Instant | null;
  retrievedDate: Instant | null;
  status: OIBusCommandStatus;
  result: string | null;
  targetVersion: string;
}

export interface OIBusUpdateVersionCommand extends BaseOIBusCommand {
  type: 'update-version';
  commandContent: {
    version: string;
    assetId: string;
    updateLauncher: boolean;
    backupFolders: string;
  };
}

export interface OIBusRestartEngineCommand extends BaseOIBusCommand {
  type: 'restart-engine';
}

export interface OIBusRegenerateCipherKeysCommand extends BaseOIBusCommand {
  type: 'regenerate-cipher-keys';
}

export interface OIBusUpdateEngineSettingsCommand extends BaseOIBusCommand {
  type: 'update-engine-settings';
  commandContent: EngineSettingsCommandDTO;
}

export interface OIBusUpdateRegistrationSettingsCommand extends BaseOIBusCommand {
  type: 'update-registration-settings';
  commandContent: {
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
      testHistoryNorthConnection: boolean;
      testHistorySouthConnection: boolean;
      testHistorySouthItem: boolean;
      createSouth: boolean;
      updateSouth: boolean;
      deleteSouth: boolean;
      createOrUpdateSouthItemsFromCsv: boolean;
      testSouthConnection: boolean;
      testSouthItem: boolean;
      createNorth: boolean;
      updateNorth: boolean;
      deleteNorth: boolean;
      testNorthConnection: boolean;
      setpoint: boolean;
    };
  };
}

export interface OIBusCreateScanModeCommand extends BaseOIBusCommand {
  type: 'create-scan-mode';
  commandContent: ScanModeCommandDTO;
}

export interface OIBusUpdateScanModeCommand extends BaseOIBusCommand {
  type: 'update-scan-mode';
  scanModeId: string;
  commandContent: ScanModeCommandDTO;
}

export interface OIBusDeleteScanModeCommand extends BaseOIBusCommand {
  type: 'delete-scan-mode';
  scanModeId: string;
}

export interface OIBusCreateIPFilterCommand extends BaseOIBusCommand {
  type: 'create-ip-filter';
  commandContent: IPFilterCommandDTO;
}

export interface OIBusUpdateIPFilterCommand extends BaseOIBusCommand {
  type: 'update-ip-filter';
  ipFilterId: string;
  commandContent: IPFilterCommandDTO;
}

export interface OIBusDeleteIPFilterCommand extends BaseOIBusCommand {
  type: 'delete-ip-filter';
  ipFilterId: string;
}

export interface OIBusCreateCertificateCommand extends BaseOIBusCommand {
  type: 'create-certificate';
  commandContent: CertificateCommandDTO;
}

export interface OIBusUpdateCertificateCommand extends BaseOIBusCommand {
  type: 'update-certificate';
  certificateId: string;
  commandContent: CertificateCommandDTO;
}

export interface OIBusDeleteCertificateCommand extends BaseOIBusCommand {
  type: 'delete-certificate';
  certificateId: string;
}

export interface OIBusCreateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'create-south';
  southConnectorId: string | null; // used to retrieve passwords in case of duplicate
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusUpdateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'update-south';
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusDeleteSouthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-south';
  southConnectorId: string;
}

export interface OIBusTestSouthConnectorCommand extends BaseOIBusCommand {
  type: 'test-south-connection';
  targetVersion: string;
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusTestSouthConnectorItemCommand extends BaseOIBusCommand {
  type: 'test-south-item';
  targetVersion: string;
  southConnectorId: string;
  itemId: string;
  commandContent: {
    southCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
    itemCommand: SouthConnectorItemCommandDTO<SouthItemSettings>;
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

export interface OIBusCreateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'create-north';
  northConnectorId: string | null; // used to retrieve passwords in case of duplicate
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusUpdateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'update-north';
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusDeleteNorthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-north';
  northConnectorId: string;
}

export interface OIBusTestNorthConnectorCommand extends BaseOIBusCommand {
  type: 'test-north-connection';
  targetVersion: string;
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand extends BaseOIBusCommand {
  type: 'create-or-update-south-items-from-csv';
  southConnectorId: string;
  commandContent: {
    deleteItemsNotPresent: boolean;
    csvContent: string;
    delimiter: string;
  };
}

export interface OIBusCreateHistoryQueryCommand extends BaseOIBusCommand {
  type: 'create-history-query';
  northConnectorId: string | null; // used to retrieve passwords in case it is created from a north connector
  southConnectorId: string | null; // used to retrieve passwords in case it is created from a south connector
  historyQueryId: string | null; // used to retrieve passwords in case of duplicate
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
}

export interface OIBusUpdateHistoryQueryCommand extends BaseOIBusCommand {
  type: 'update-history-query';
  historyQueryId: string;
  commandContent: {
    resetCache: boolean;
    historyQuery: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
  };
}

export interface OIBusDeleteHistoryQueryCommand extends BaseOIBusCommand {
  type: 'delete-history-query';
  historyQueryId: string;
}

export interface OIBusTestHistoryQueryNorthConnectionCommand extends BaseOIBusCommand {
  type: 'test-history-query-north-connection';
  historyQueryId: string;
  northConnectorId: string | null;
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
}

export interface OIBusTestHistoryQuerySouthConnectionCommand extends BaseOIBusCommand {
  type: 'test-history-query-south-connection';
  historyQueryId: string;
  southConnectorId: string | null;
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
}

export interface OIBusTestHistoryQuerySouthItemCommand extends BaseOIBusCommand {
  type: 'test-history-query-south-item';
  historyQueryId: string;
  southConnectorId: string | null;
  itemId: string;
  commandContent: {
    historyCommand: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
    itemCommand: HistoryQueryItemCommandDTO<SouthItemSettings>;
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

export interface OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand extends BaseOIBusCommand {
  type: 'create-or-update-history-query-south-items-from-csv';
  historyQueryId: string;
  commandContent: {
    deleteItemsNotPresent: boolean;
    csvContent: string;
    delimiter: string;
  };
}

export interface OIBusUpdateHistoryQueryStatusCommand extends BaseOIBusCommand {
  type: 'update-history-query-status';
  historyQueryId: string;
  commandContent: {
    historyQueryStatus: HistoryQueryStatus;
  };
}

export interface OIBusSetpointCommand extends BaseOIBusCommand {
  type: 'setpoint';
  northConnectorId: string;
  commandContent: Array<{
    reference: string;
    value: string;
  }>;
}

export type OIBusCommand =
  | OIBusUpdateVersionCommand
  | OIBusRestartEngineCommand
  | OIBusRegenerateCipherKeysCommand
  | OIBusUpdateEngineSettingsCommand
  | OIBusUpdateRegistrationSettingsCommand
  | OIBusCreateScanModeCommand
  | OIBusUpdateScanModeCommand
  | OIBusDeleteScanModeCommand
  | OIBusCreateIPFilterCommand
  | OIBusUpdateIPFilterCommand
  | OIBusDeleteIPFilterCommand
  | OIBusCreateCertificateCommand
  | OIBusUpdateCertificateCommand
  | OIBusDeleteCertificateCommand
  | OIBusCreateSouthConnectorCommand
  | OIBusUpdateSouthConnectorCommand
  | OIBusDeleteSouthConnectorCommand
  | OIBusTestSouthConnectorCommand
  | OIBusTestSouthConnectorItemCommand
  | OIBusCreateNorthConnectorCommand
  | OIBusUpdateNorthConnectorCommand
  | OIBusDeleteNorthConnectorCommand
  | OIBusTestNorthConnectorCommand
  | OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand
  | OIBusCreateHistoryQueryCommand
  | OIBusUpdateHistoryQueryCommand
  | OIBusDeleteHistoryQueryCommand
  | OIBusTestHistoryQueryNorthConnectionCommand
  | OIBusTestHistoryQuerySouthConnectionCommand
  | OIBusTestHistoryQuerySouthItemCommand
  | OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand
  | OIBusUpdateHistoryQueryStatusCommand
  | OIBusSetpointCommand;
