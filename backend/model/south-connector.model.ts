/**
 * DTO for South connectors
 */
export interface SouthConnectorDTO {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: object;
}

/**
 * Command DTO for South connector
 */
export interface SouthConnectorCommandDTO {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: object;
}

/**
 * DTO used for South scan (a point/query/regexp and its settings linked to a scan mode)
 */
export interface SouthScanDTO {
  id: string;
  name: string;
  southId: string;
  settings: object;
  scanModeId: string;
}

/**
 * Command DTO used for South scan (a point/query/folder and its settings linked to a scan mode)
 */
export interface SouthScanCommandDTO {
  southId: string;
  name: string;
  settings: object;
  scanModeId: string;
}
