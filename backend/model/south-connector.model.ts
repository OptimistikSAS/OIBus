export interface SouthType {
  category: string;
  type: string;
  description: string;
  modes: {
    subscription: boolean;
    lastPoint: boolean;
    lastFile: boolean;
    historyPoint: boolean;
    historyFile: boolean;
  };
}

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
 * DTO used for South item (a point/query/regexp and its settings linked to a scan mode)
 */
export interface SouthItemDTO {
  id: string;
  name: string;
  southId: string;
  settings: object;
  scanModeId: string;
}

/**
 * Command DTO used for South item (a point/query/folder and its settings linked to a scan mode)
 */
export interface SouthItemCommandDTO {
  name: string;
  settings: object;
  scanModeId: string;
}

export interface SouthItemSearchParam {
  page: number | null;
  name: string | null;
}
