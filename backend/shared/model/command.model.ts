import { EngineSettingsCommandDTO } from './engine.model';
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
  'setpoint'
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-version",
 *   "status": "COMPLETED",
 *   "ack": true,
 *   "retrievedDate": "2023-10-31T12:34:56.789Z",
 *   "completedDate": "2023-10-31T12:35:56.789Z",
 *   "result": "Success"
 * }
 */
export interface BaseOIBusCommandDTO {
  /**
   * The unique identifier of the command.
   * @example "cmd123"
   */
  id: string;

  /**
   * The type of the command.
   * @example "update-version"
   */
  type: OIBusCommandType;

  /**
   * The current status of the command.
   * @example "COMPLETED"
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-version",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "commandContent": {
 *     "version": "3.7.0",
 *     "assetId": "asset123",
 *     "updateLauncher": true,
 *     "backupFolders": "/backup"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "restart-engine",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "regenerate-cipher-keys",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-engine-settings",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "Engine 1",
 *     "port": 8080,
 *     "proxyEnabled": false,
 *     "proxyPort": null,
 *     "logParameters": {
 *       "console": { "level": "info" },
 *       "file": { "level": "debug", "maxFileSize": 10485760, "numberOfFiles": 5 },
 *       "database": { "level": "warn", "maxNumberOfLogs": 10000 },
 *       "loki": { "level": "error", "interval": 60, "address": "http://loki:3100", "username": "user", "password": "pass" },
 *       "oia": { "level": "info", "interval": 60 }
 *     }
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-registration-settings",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "commandRefreshInterval": 60,
 *     "commandRetryInterval": 10,
 *     "messageRetryInterval": 10
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-scan-mode",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "Daily Scan",
 *     "description": "Scans for new data every day at midnight",
 *     "cron": "0 0 * * *"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-scan-mode",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "scanModeId": "scan123",
 *   "commandContent": {
 *     "name": "Daily Scan",
 *     "description": "Scans for new data every day at midnight",
 *     "cron": "0 0 * * *"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-scan-mode",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "scanModeId": "scan123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-ip-filter",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "address": "192.168.1.1",
 *     "description": "Allow traffic from the local admin workstation"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-ip-filter",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "ipFilterId": "filter123",
 *   "commandContent": {
 *     "address": "192.168.1.1",
 *     "description": "Allow traffic from the local admin workstation"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-ip-filter",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "ipFilterId": "filter123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-certificate",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "Server SSL Certificate",
 *     "description": "SSL certificate for securing server communications",
 *     "regenerateCertificate": false,
 *     "options": {
 *       "commonName": "example.com",
 *       "countryName": "US",
 *       "stateOrProvinceName": "California",
 *       "localityName": "San Francisco",
 *       "organizationName": "Example Inc.",
 *       "keySize": 2048,
 *       "daysBeforeExpiry": 365
 *     }
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-certificate",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "certificateId": "cert123",
 *   "commandContent": {
 *     "name": "Server SSL Certificate",
 *     "description": "SSL certificate for securing server communications",
 *     "regenerateCertificate": false,
 *     "options": {
 *       "commonName": "example.com",
 *       "countryName": "US",
 *       "stateOrProvinceName": "California",
 *       "localityName": "San Francisco",
 *       "organizationName": "Example Inc.",
 *       "keySize": 2048,
 *       "daysBeforeExpiry": 365
 *     }
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-certificate",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "certificateId": "cert123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-south",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "South Connector 1",
 *     "description": "Connector for south data source",
 *     "type": "opcua",
 *     "enabled": true,
 *     "settings": TODO,
 *     "items": []
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-south",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "southConnectorId": "south123",
 *   "commandContent": {
 *     "name": "South Connector 1",
 *     "description": "Connector for south data source",
 *     "type": "opcua",
 *     "enabled": true,
 *     "settings": {}, // TODO
 *     "items": []
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-south",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "southConnectorId": "south123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-south-connection",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "southConnectorId": "south123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-south-item",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "southConnectorId": "south123",
 *   "itemId": "item456"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-north",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "North Connector 1",
 *     "description": "Connector for north data destination",
 *     "type": "http",
 *     "enabled": true,
 *     "settings": {} // TODO
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-north",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "northConnectorId": "north123",
 *   "commandContent": {
 *     "name": "North Connector 1",
 *     "description": "Connector for north data destination",
 *     "type": "http",
 *     "enabled": true,
 *     "settings": {} // TODO
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-north",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "northConnectorId": "north123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-north-connection",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "northConnectorId": "north123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-or-update-south-items-from-csv",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "southConnectorId": "south123",
 *   "commandContent": {
 *     "deleteItemsNotPresent": false,
 *     "csvContent": "id,name,address\n1,Item 1,Address 1",
 *     "delimiter": ","
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-history-query",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "commandContent": {
 *     "name": "History Query 1",
 *     "description": "Query for historical data",
 *     "enabled": true,
 *     "startDate": "2023-01-01T00:00:00Z",
 *     "endDate": "2023-01-31T23:59:59Z",
 *     "interval": "PT1H",
 *     "southType": "opcua",
 *     "northType": "http",
 *     "southSettings": {}, // TODO
 *     "northSettings": {}, // TODO
 *     "items": []
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-history-query",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "commandContent": {
 *     "resetCache": false,
 *     "historyQuery": {
 *       "name": "History Query 1",
 *       "description": "Query for historical data",
 *       "enabled": true,
 *       "startDate": "2023-01-01T00:00:00Z",
 *       "endDate": "2023-01-31T23:59:59Z",
 *       "interval": "PT1H",
 *       "southType": "opcua",
 *       "northType": "http",
 *       "southSettings": {}, // TODO
 *       "northSettings": {}, // TODO
 *       "items": []
 *     }
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "delete-history-query",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123"
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-history-query-north-connection",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "northConnectorId": "north123",
 *   "commandContent": {
 *     "name": "History Query 1",
 *     "description": "Query for historical data",
 *     "enabled": true,
 *     "startDate": "2023-01-01T00:00:00Z",
 *     "endDate": "2023-01-31T23:59:59Z",
 *     "interval": "PT1H",
 *     "southType": "opcua",
 *     "northType": "http",
 *     "southSettings": {}, // TODO
 *     "northSettings": {}, // TODO
 *     "items": []
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-history-query-south-connection",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "southConnectorId": "south123",
 *   "commandContent": {
 *     "name": "History Query 1",
 *     "description": "Query for historical data",
 *     "enabled": true,
 *     "startDate": "2023-01-01T00:00:00Z",
 *     "endDate": "2023-01-31T23:59:59Z",
 *     "interval": "PT1H",
 *     "southType": "opcua",
 *     "northType": "http",
 *     "southSettings": {}, // TODO
 *     "northSettings": {}, // TODO
 *     "items": []
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "test-history-query-south-item",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "southConnectorId": "south123",
 *   "itemId": "item456",
 *   "commandContent": {
 *     "historyCommand": {
 *       "name": "History Query 1",
 *       "description": "Query for historical data",
 *       "enabled": true,
 *       "startDate": "2023-01-01T00:00:00Z",
 *       "endDate": "2023-01-31T23:59:59Z",
 *       "interval": "PT1H",
 *       "southType": "opcua",
 *       "northType": "http",
 *       "southSettings": {}, // TODO
 *       "northSettings": {}, // TODO
 *       "items": []
 *     },
 *     "itemCommand": {
 *       "name": "Item 1",
 *       "description": "Item for historical data",
 *       "settings": {} // TODO
 *     },
 *     "testingSettings": {
 *       "startDate": "2023-01-01T00:00:00Z",
 *       "endDate": "2023-01-01T23:59:59Z"
 *     }
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "create-or-update-history-query-south-items-from-csv",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "commandContent": {
 *     "deleteItemsNotPresent": false,
 *     "csvContent": "id,name,address\r\n1,Item 1,Address 1",
 *     "delimiter": ","
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "update-history-query-status",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "historyQueryId": "history123",
 *   "commandContent": {
 *     "historyQueryStatus": "RUNNING"
 *   }
 * }
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
 *
 * @example
 * {
 *   "id": "cmd123",
 *   "type": "setpoint",
 *   "status": "RETRIEVED",
 *   "ack": false,
 *   "retrievedDate": null,
 *   "completedDate": null,
 *   "result": null,
 *   "targetVersion": "3.7.0",
 *   "northConnectorId": "north123",
 *   "commandContent": [
 *     {
 *       "reference": "setpoint1",
 *       "value": "100"
 *     }
 *   ]
 * }
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
  | OIBusSetpointCommandDTO;

/**
 * Parameters for searching commands.
 *
 * @example
 * {
 *   "page": 1,
 *   "types": ["update-version", "restart-engine"],
 *   "status": ["RETRIEVED", "RUNNING"],
 *   "ack": true,
 *   "start": "2023-10-31T00:00:00Z",
 *   "end": "2023-10-31T23:59:59Z"
 * }
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
