import { EngineSettingsCommandDTO, CacheSearchParam } from './engine.model';
import { Instant } from './types';
import { ScanModeCommandDTO } from './scan-mode.model';
import { SouthConnectorCommandDTO, SouthConnectorItemTestingSettings } from './south-connector.model';
import { NorthConnectorCommandDTO } from './north-connector.model';
import { IPFilterCommandDTO } from './ip-filter.model';
import { CertificateCommandDTO } from './certificate.model';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryStatus } from './history-query.model';

/**
 * List of possible OIBus command types.
 */
export const OIBUS_COMMAND_TYPES = [
  'update-version',
  'restart-engine',
  'regenerate-cipher-keys',
  'update-engine-settings',
  'update-registration-settings',
  'create-scan-mode',
  'update-scan-mode',
  'delete-scan-mode',
  'create-ip-filter',
  'update-ip-filter',
  'delete-ip-filter',
  'create-certificate',
  'update-certificate',
  'delete-certificate',
  'create-south',
  'update-south',
  'delete-south',
  'test-south-connection',
  'test-south-item',
  'create-north',
  'update-north',
  'delete-north',
  'test-north-connection',
  'create-or-update-south-items-from-csv',
  'create-history-query',
  'update-history-query',
  'delete-history-query',
  'test-history-query-north-connection',
  'test-history-query-south-connection',
  'test-history-query-south-item',
  'create-or-update-history-query-south-items-from-csv',
  'update-history-query-status',
  'setpoint',
  'search-north-cache-content',
  'search-history-cache-content',
  'get-north-cache-file-content',
  'get-history-cache-file-content',
  'remove-north-cache-content',
  'remove-history-cache-content',
  'move-north-cache-content',
  'move-history-cache-content'
] as const;

/**
 * Type representing an OIBus command type.
 * @example 'update-version'
 */
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

/**
 * List of possible OIBus command statuses.
 */
export const OIBUS_COMMAND_STATUS = ['RETRIEVED', 'RUNNING', 'ERRORED', 'CANCELLED', 'COMPLETED'] as const;

/**
 * Type representing an OIBus command status.
 * @example 'COMPLETED'
 */
export type OIBusCommandStatus = (typeof OIBUS_COMMAND_STATUS)[number];

/**
 * Base Data Transfer Object for an OIBus command.
 * Contains common properties for all OIBus commands.
 */
export interface BaseOIBusCommandDTO {
  /**
   * The unique identifier of the command.
   * @example "cmd123"
   */
  id: string;

  /**
   * The type of the command.
   */
  type: OIBusCommandType;

  /**
   * The current status of the command.
   */
  status: OIBusCommandStatus;

  /**
   * Whether the command has been acknowledged.
   * @example true
   */
  ack: boolean;

  /**
   * The date and time when the command was retrieved.
   * @example "2023-10-31T12:34:56.789Z"
   */
  retrievedDate: Instant | null;

  /**
   * The date and time when the command was completed.
   * @example "2023-10-31T12:35:56.789Z"
   */
  completedDate: Instant | null;

  /**
   * The result of the command execution.
   * @example "Success"
   */
  result: string | null;
}

/**
 * Command DTO for updating the OIBus version.
 */
export interface OIBusUpdateVersionCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-version';

  /**
   * The content of the command, including version details and update options.
   */
  commandContent: {
    /**
     * The version to update to.
     * @example "3.7.0"
     */
    version: string;

    /**
     * The asset ID for the update.
     * @example "asset123"
     */
    assetId: string;

    /**
     * Whether to update the launcher.
     * @example true
     */
    updateLauncher: boolean;

    /**
     * The folders to back up before updating.
     * @example "/backup"
     */
    backupFolders: string;
  };
}

/**
 * Command DTO for restarting the engine.
 */
export interface OIBusRestartEngineCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'restart-engine';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;
}

/**
 * Command DTO for regenerating cipher keys.
 */
export interface OIBusRegenerateCipherKeysCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'regenerate-cipher-keys';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;
}

/**
 * Command DTO for updating engine settings.
 */
export interface OIBusUpdateEngineSettingsCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-engine-settings';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including engine settings.
   */
  commandContent: EngineSettingsCommandDTO;
}

/**
 * Command DTO for updating registration settings.
 */
export interface OIBusUpdateRegistrationSettingsCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-registration-settings';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including registration settings.
   */
  commandContent: {
    /**
     * The interval in seconds for refreshing commands.
     * @example 60
     */
    commandRefreshInterval: number;

    /**
     * The interval in seconds for retrying commands.
     * @example 10
     */
    commandRetryInterval: number;

    /**
     * The interval in seconds for retrying messages.
     * @example 10
     */
    messageRetryInterval: number;
  };
}

/**
 * Command DTO for creating a scan mode.
 */
export interface OIBusCreateScanModeCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-scan-mode';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including scan mode details.
   */
  commandContent: ScanModeCommandDTO;
}

/**
 * Command DTO for updating a scan mode.
 */
export interface OIBusUpdateScanModeCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-scan-mode';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the scan mode to update.
   * @example "scan123"
   */
  scanModeId: string;

  /**
   * The content of the command, including updated scan mode details.
   */
  commandContent: ScanModeCommandDTO;
}

/**
 * Command DTO for deleting a scan mode.
 */
export interface OIBusDeleteScanModeCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-scan-mode';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the scan mode to delete.
   * @example "scan123"
   */
  scanModeId: string;
}

/**
 * Command DTO for creating an IP filter.
 */
export interface OIBusCreateIPFilterCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-ip-filter';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including IP filter details.
   */
  commandContent: IPFilterCommandDTO;
}

/**
 * Command DTO for updating an IP filter.
 */
export interface OIBusUpdateIPFilterCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-ip-filter';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the IP filter to update.
   * @example "filter123"
   */
  ipFilterId: string;

  /**
   * The content of the command, including updated IP filter details.
   */
  commandContent: IPFilterCommandDTO;
}

/**
 * Command DTO for deleting an IP filter.
 */
export interface OIBusDeleteIPFilterCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-ip-filter';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the IP filter to delete.
   * @example "filter123"
   */
  ipFilterId: string;
}

/**
 * Command DTO for creating a certificate.
 */
export interface OIBusCreateCertificateCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-certificate';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including certificate details.
   */
  commandContent: CertificateCommandDTO;
}

/**
 * Command DTO for updating a certificate.
 */
export interface OIBusUpdateCertificateCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-certificate';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the certificate to update.
   * @example "cert123"
   */
  certificateId: string;

  /**
   * The content of the command, including updated certificate details.
   */
  commandContent: CertificateCommandDTO;
}

/**
 * Command DTO for deleting a certificate.
 */
export interface OIBusDeleteCertificateCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-certificate';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the certificate to delete.
   * @example "cert123"
   */
  certificateId: string;
}

/**
 * Command DTO for creating a south connector.
 */
export interface OIBusCreateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-south';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including south connector details.
   */
  commandContent: SouthConnectorCommandDTO;
}

/**
 * Command DTO for updating a south connector.
 */
export interface OIBusUpdateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-south';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the south connector to update.
   * @example "south123"
   */
  southConnectorId: string;

  /**
   * The content of the command, including updated south connector details.
   */
  commandContent: SouthConnectorCommandDTO;
}

/**
 * Command DTO for deleting a south connector.
 */
export interface OIBusDeleteSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-south';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the south connector to delete.
   * @example "south123"
   */
  southConnectorId: string;
}

/**
 * Command DTO for testing a south connector connection.
 */
export interface OIBusTestSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-south-connection';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the south connector to test.
   * @example "south123"
   */
  southConnectorId: string;
}

/**
 * Command DTO for testing a south connector item.
 */
export interface OIBusTestSouthConnectorItemCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-south-item';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the south connector.
   * @example "south123"
   */
  southConnectorId: string;

  /**
   * The ID of the item to test.
   * @example "item456"
   */
  itemId: string;
}

/**
 * Command DTO for creating a north connector.
 */
export interface OIBusCreateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-north';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including north connector details.
   */
  commandContent: NorthConnectorCommandDTO;
}

/**
 * Command DTO for updating a north connector.
 */
export interface OIBusUpdateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-north';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the north connector to update.
   * @example "north123"
   */
  northConnectorId: string;

  /**
   * The content of the command, including updated north connector details.
   */
  commandContent: NorthConnectorCommandDTO;
}

/**
 * Command DTO for deleting a north connector.
 */
export interface OIBusDeleteNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-north';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the north connector to delete.
   * @example "north123"
   */
  northConnectorId: string;
}

/**
 * Command DTO for testing a north connector connection.
 */
export interface OIBusTestNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-north-connection';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the north connector to test.
   * @example "north123"
   */
  northConnectorId: string;
}

/**
 * Command DTO for creating or updating south connector items from CSV.
 */
export interface OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-or-update-south-items-from-csv';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the south connector.
   * @example "south123"
   */
  southConnectorId: string;

  /**
   * The content of the command, including CSV content and options.
   */
  commandContent: {
    /**
     * Whether to delete items not present in the CSV.
     * @example false
     */
    deleteItemsNotPresent: boolean;

    /**
     * The CSV content to import.
     * @example "id,name,address\n1,Item 1,Address 1"
     */
    csvContent: string;

    /**
     * The delimiter used in the CSV.
     * @example ","
     */
    delimiter: string;
  };
}

/**
 * Command DTO for creating a history query.
 */
export interface OIBusCreateHistoryQueryCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-history-query';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The content of the command, including history query details.
   */
  commandContent: HistoryQueryCommandDTO;
}

/**
 * Command DTO for updating a history query.
 */
export interface OIBusUpdateHistoryQueryCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-history-query';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query to update.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The content of the command, including history query update details.
   */
  commandContent: {
    /**
     * Whether to reset the cache.
     * @example false
     */
    resetCache: boolean;

    /**
     * The updated history query details.
     */
    historyQuery: HistoryQueryCommandDTO;
  };
}

/**
 * Command DTO for deleting a history query.
 */
export interface OIBusDeleteHistoryQueryCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'delete-history-query';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query to delete.
   * @example "history123"
   */
  historyQueryId: string;
}

/**
 * Command DTO for testing a history query north connection.
 */
export interface OIBusTestHistoryQueryNorthConnectionCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-history-query-north-connection';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The ID of the north connector to test. Can be `null` to use the default north connector.
   * @example "north123"
   */
  northConnectorId: string | undefined;

  /**
   * The content of the command, including history query details.
   */
  commandContent: HistoryQueryCommandDTO;
}

/**
 * Command DTO for testing a history query south connection.
 */
export interface OIBusTestHistoryQuerySouthConnectionCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-history-query-south-connection';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The ID of the south connector to test. Can be `null` to use the default south connector.
   * @example "south123"
   */
  southConnectorId: string | undefined;

  /**
   * The content of the command, including history query details.
   */
  commandContent: HistoryQueryCommandDTO;
}

/**
 * Command DTO for testing a history query south item.
 */
export interface OIBusTestHistoryQuerySouthItemCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'test-history-query-south-item';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The ID of the south connector. Can be `null` to use the default south connector.
   * @example "south123"
   */
  southConnectorId: string | undefined;

  /**
   * The ID of the item to test.
   * @example "item456"
   */
  itemId: string;

  /**
   * The content of the command, including history query, item, and testing settings.
   */
  commandContent: {
    /**
     * The history query details.
     */
    historyCommand: HistoryQueryCommandDTO;

    /**
     * The item details.
     */
    itemCommand: HistoryQueryItemCommandDTO;

    /**
     * The testing settings.
     */
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

/**
 * Command DTO for creating or updating history query south items from CSV.
 */
export interface OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'create-or-update-history-query-south-items-from-csv';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The content of the command, including CSV content and options.
   */
  commandContent: {
    /**
     * Whether to delete items not present in the CSV.
     * @example false
     */
    deleteItemsNotPresent: boolean;

    /**
     * The CSV content to import.
     * @example "id,name,address\r\n1,Item 1,Address 1"
     */
    csvContent: string;

    /**
     * The delimiter used in the CSV.
     * @example ","
     */
    delimiter: string;
  };
}

/**
 * Command DTO for updating a history query status.
 */
export interface OIBusUpdateHistoryQueryStatusCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'update-history-query-status';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the history query.
   * @example "history123"
   */
  historyQueryId: string;

  /**
   * The content of the command, including the new history query status.
   */
  commandContent: {
    /**
     * The new status of the history query.
     * @example "RUNNING"
     */
    historyQueryStatus: HistoryQueryStatus;
  };
}

/**
 * Command DTO for sending setpoints.
 */
export interface OIBusSetpointCommandDTO extends BaseOIBusCommandDTO {
  /**
   * The type of the command.
   */
  type: 'setpoint';

  /**
   * The target version for the command.
   * @example "3.7.0"
   */
  targetVersion: string;

  /**
   * The ID of the north connector.
   * @example "north123"
   */
  northConnectorId: string;

  /**
   * The content of the command, including setpoint details.
   */
  commandContent: Array<{
    /**
     * The reference of the setpoint.
     * @example "setpoint1"
     */
    reference: string;

    /**
     * The value of the setpoint.
     * @example "100"
     */
    value: string;
  }>;
}

export interface OIBusSearchNorthCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'search-north-cache-content';
  northConnectorId: string;
  commandContent: {
    searchParams: CacheSearchParam;
    folder: 'cache' | 'archive' | 'error';
  };
}

export interface OIBusSearchHistoryCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'search-history-cache-content';
  historyQueryId: string;
  commandContent: {
    searchParams: CacheSearchParam;
    folder: 'cache' | 'archive' | 'error';
  };
}

export interface OIBusGetNorthCacheFileContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'get-north-cache-file-content';
  northConnectorId: string;
  commandContent: {
    folder: 'cache' | 'archive' | 'error';
    filename: string;
  };
}

export interface OIBusGetHistoryCacheFileContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'get-history-cache-file-content';
  historyQueryId: string;
  commandContent: {
    folder: 'cache' | 'archive' | 'error';
    filename: string;
  };
}

export interface OIBusRemoveNorthCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'remove-north-cache-content';
  northConnectorId: string;
  commandContent: {
    folder: 'cache' | 'archive' | 'error';
    metadataFilenameList: Array<string>;
  };
}

export interface OIBusRemoveHistoryCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'remove-history-cache-content';
  historyQueryId: string;
  commandContent: {
    folder: 'cache' | 'archive' | 'error';
    metadataFilenameList: Array<string>;
  };
}

export interface OIBusMoveNorthCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'move-north-cache-content';
  northConnectorId: string;
  commandContent: {
    originFolder: 'cache' | 'archive' | 'error';
    destinationFolder: 'cache' | 'archive' | 'error';
    cacheContentList: Array<string>;
  };
}

export interface OIBusMoveHistoryCacheContentCommandDTO extends BaseOIBusCommandDTO {
  type: 'move-history-cache-content';
  historyQueryId: string;
  commandContent: {
    originFolder: 'cache' | 'archive' | 'error';
    destinationFolder: 'cache' | 'archive' | 'error';
    cacheContentList: Array<string>;
  };
}

/**
 * Union type representing all possible OIBus command DTOs.
 */
export type OIBusCommandDTO =
  | OIBusUpdateVersionCommandDTO
  | OIBusRegenerateCipherKeysCommandDTO
  | OIBusRestartEngineCommandDTO
  | OIBusUpdateEngineSettingsCommandDTO
  | OIBusUpdateRegistrationSettingsCommandDTO
  | OIBusCreateScanModeCommandDTO
  | OIBusUpdateScanModeCommandDTO
  | OIBusDeleteScanModeCommandDTO
  | OIBusCreateIPFilterCommandDTO
  | OIBusUpdateIPFilterCommandDTO
  | OIBusDeleteIPFilterCommandDTO
  | OIBusCreateCertificateCommandDTO
  | OIBusUpdateCertificateCommandDTO
  | OIBusDeleteCertificateCommandDTO
  | OIBusCreateSouthConnectorCommandDTO
  | OIBusUpdateSouthConnectorCommandDTO
  | OIBusDeleteSouthConnectorCommandDTO
  | OIBusTestSouthConnectorCommandDTO
  | OIBusTestSouthConnectorItemCommandDTO
  | OIBusCreateNorthConnectorCommandDTO
  | OIBusUpdateNorthConnectorCommandDTO
  | OIBusDeleteNorthConnectorCommandDTO
  | OIBusTestNorthConnectorCommandDTO
  | OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO
  | OIBusCreateHistoryQueryCommandDTO
  | OIBusUpdateHistoryQueryCommandDTO
  | OIBusDeleteHistoryQueryCommandDTO
  | OIBusTestHistoryQueryNorthConnectionCommandDTO
  | OIBusTestHistoryQuerySouthConnectionCommandDTO
  | OIBusTestHistoryQuerySouthItemCommandDTO
  | OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO
  | OIBusUpdateHistoryQueryStatusCommandDTO
  | OIBusSetpointCommandDTO
  | OIBusSearchNorthCacheContentCommandDTO
  | OIBusSearchHistoryCacheContentCommandDTO
  | OIBusGetNorthCacheFileContentCommandDTO
  | OIBusGetHistoryCacheFileContentCommandDTO
  | OIBusRemoveNorthCacheContentCommandDTO
  | OIBusRemoveHistoryCacheContentCommandDTO
  | OIBusMoveNorthCacheContentCommandDTO
  | OIBusMoveHistoryCacheContentCommandDTO;

/**
 * Parameters for searching commands.
 */
export interface CommandSearchParam {
  /**
   * The page number for paginated results.
   * @example 1
   */
  page: number;

  /**
   * The types of commands to filter by.
   * @example ["update-version", "restart-engine"]
   */
  types: Array<OIBusCommandType>;

  /**
   * The statuses of commands to filter by.
   * @example ["RETRIEVED", "RUNNING"]
   */
  status: Array<OIBusCommandStatus>;

  /**
   * Whether to filter by acknowledged commands.
   * @example true
   */
  ack: boolean | undefined;

  /**
   * The start date and time for the search.
   * @example "2023-10-31T00:00:00Z"
   */
  start: Instant | undefined;

  /**
   * The end date and time for the search.
   * @example "2023-10-31T23:59:59Z"
   */
  end: Instant | undefined;
}
