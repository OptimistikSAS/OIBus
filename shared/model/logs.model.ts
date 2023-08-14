import { LogLevel, ScopeType } from './engine.model';

/**
 * DTO used for Log entries
 */
export interface LogDTO {
  timestamp: string;
  level: LogLevel;
  scopeType: ScopeType;
  scopeId?: string;
  scopeName?: string;
  message: string;
}

export interface Scope {
  scopeId: string;
  scopeName: string;
}

export interface PinoLog {
  msg: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  time: number;
  level: string;
}

export const LEVEL_FORMAT: { [key: string]: LogLevel } = {
  '10': 'trace',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error',
  '60': 'fatal'
};

export interface LogStreamValuesCommandDTO {
  values: Array<[string, string]>;
  stream: {
    level: LogLevel;
    oibus: string;
    oibusName: string;
    scopeType: string;
    scopeId: string | null;
    scopeName: string | null;
  };
}
export interface LogStreamCommandDTO {
  streams: Array<LogStreamValuesCommandDTO>;
}

export interface LogSearchParam {
  page: number;
  start: string | null;
  end: string | null;
  levels: Array<LogLevel>;
  scopeIds: Array<string>;
  scopeTypes: Array<string>;
  messageContent: string | null;
}
