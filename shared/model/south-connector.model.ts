import { OibFormControl } from './form.model';
import Joi from 'joi';

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
  settings: any;
}

/**
 * Command DTO for South connector
 */
export interface SouthConnectorCommandDTO {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: any;
}

/**
 * DTO used for South scan (a point/query/regexp and its settings linked to a scan mode)
 */
export interface SouthItemDTO {
  id: string;
  name: string;
  southId: string;
  settings: any;
  scanModeId: string;
}

/**
 * Command DTO used for South scan (a point/query/folder and its settings linked to a scan mode)
 */
export interface SouthItemCommandDTO {
  name: string;
  settings: any;
  scanModeId: string | null;
}

export interface SouthItemSearchParam {
  name: string | null;
  page: number;
}

export interface SouthItemManifest {
  scanMode: {
    acceptSubscription: boolean;
    subscriptionOnly: boolean;
  };
  settings: Array<OibFormControl>;
  schema: Joi.ObjectSchema;
}

export interface SouthConnectorManifest {
  category: string;
  name: string;
  description: string;
  modes: {
    subscription: boolean;
    lastPoint: boolean;
    lastFile: boolean;
    historyPoint: boolean;
    historyFile: boolean;
  };
  settings: Array<OibFormControl>;
  schema: Joi.ObjectSchema;
  items: SouthItemManifest;
}
